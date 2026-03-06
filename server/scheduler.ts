import * as schedule from 'node-schedule';
import { scrapeMieBiddings, convertToInsertBidding, type SearchConditions } from './scraper';
import { insertBiddingsBatch, insertScrapingLog, getActiveSchedules, updateScheduleSetting, getActiveNotificationSubscriptions } from './db';
import { runNotificationCheck } from './notificationJob';
import { detectNewBiddings } from './newBiddingDetector';
import { runCleanupJob } from './cleanupJob';

/**
 * スケジューラーサービス
 * データベースに保存されたスケジュール設定に基づいて、定期的にスクレイピングを実行する
 */

// アクティブなスケジュールジョブを管理
const activeJobs = new Map<number, schedule.Job>();

// ========== 排他制御: スクレイピングキュー ==========
// Seleniumは同時に複数起動できないため、キュー式で順番に実行する
let isScrapingRunning = false;
const scrapingQueue: Array<{ scheduleId: number; scheduleName: string }> = [];

async function enqueueScrapingJob(scheduleId: number, scheduleName: string) {
  scrapingQueue.push({ scheduleId, scheduleName });
  console.log(`[Scheduler] Queued scraping job: ${scheduleName} (queue size: ${scrapingQueue.length})`);
  await processScrapingQueue();
}

async function processScrapingQueue() {
  if (isScrapingRunning) {
    console.log('[Scheduler] Scraping already running, job will wait in queue');
    return;
  }
  if (scrapingQueue.length === 0) return;

  isScrapingRunning = true;
  while (scrapingQueue.length > 0) {
    const job = scrapingQueue.shift()!;
    console.log(`[Scheduler] Starting queued job: ${job.scheduleName} (remaining: ${scrapingQueue.length})`);
    try {
      await executeScheduledScraping(job.scheduleId, job.scheduleName);
    } catch (err) {
      console.error(`[Scheduler] Queued job failed: ${job.scheduleName}`, err);
    }
  }
  isScrapingRunning = false;
}
// ====================================================

/**
 * スケジューラーを初期化し、データベースからスケジュール設定を読み込んで登録
 */
export async function initializeScheduler() {
  console.log('[Scheduler] Initializing scheduler...');
  
  try {
    // データベースからアクティブなスケジュール設定を読み込む
    const schedules = await getActiveSchedules();
    
    if (!schedules || schedules.length === 0) {
      console.log('[Scheduler] No active schedules found. Creating default schedule (daily at 9:00 AM)...');
      await createDefaultSchedule();
    } else {
      // 全スケジュールを登録（awaitで確実に完了させる）
      for (const scheduleConfig of schedules) {
        await registerSchedule(scheduleConfig);
      }
      console.log(`[Scheduler] Initialized with ${schedules.length} active schedule(s)`);
    }
    
    // 通知ジョブのスケジュールを登録
    await initializeNotificationSchedules();
    
    // クリーンアップジョブのスケジュールを登録（毎日03:00 JST）
    initializeCleanupSchedule();
    
    // 登録済みスケジュールの一覧をログ出力
    console.log(`[Scheduler] Active jobs in memory: ${activeJobs.size}`);
    activeJobs.forEach((job, id) => {
      const next = job.nextInvocation();
      console.log(`[Scheduler]   - ID=${id}, next=${next?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    });
  } catch (error) {
    console.error('[Scheduler] Failed to initialize:', error);
  }
}

/**
 * クリーンアップジョブのスケジュールを初期化（毎日03:00 JST）
 */
function initializeCleanupSchedule() {
  console.log('[Scheduler] Initializing cleanup schedule...');
  
  // JST 03:00 = UTC 18:00 (前日)
  const cronExpr = '0 18 * * *'; // 毎日18:00 UTC
  
  try {
    const spec: schedule.RecurrenceSpecDateRange = {
      rule: cronExpr,
      tz: 'Etc/UTC'
    };
    
    const job = schedule.scheduleJob(spec, async () => {
      console.log('[Scheduler] Executing cleanup job at 03:00 JST');
      await runCleanupJob();
    });
    
    if (job) {
      console.log(`[Scheduler] Registered cleanup schedule: 03:00 JST (${cronExpr} UTC)`);
      const nextExec = job.nextInvocation();
      console.log(`[Scheduler] Next cleanup: ${nextExec?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    }
  } catch (error) {
    console.error('[Scheduler] Failed to register cleanup schedule:', error);
  }
}

/**
 * 通知ジョブのスケジュールを初期化
 */
async function initializeNotificationSchedules() {
  console.log('[Scheduler] Initializing notification schedules...');
  
  try {
    // 有効な通知設定を取得
    const subscriptions = await getActiveNotificationSubscriptions();
    
    if (subscriptions.length === 0) {
      console.log('[Scheduler] No active notification subscriptions found');
      return;
    }
    
    // 各通知設定の通知時刻を集約
    const notificationTimes = new Set<string>();
    for (const sub of subscriptions) {
      const times = sub.notificationTimes.split(',').map((t: string) => t.trim());
      times.forEach(time => notificationTimes.add(time));
    }
    
    // 各通知時刻にスケジュールを登録
    notificationTimes.forEach(time => {
      registerNotificationSchedule(time);
    });
    
    console.log(`[Scheduler] Registered ${notificationTimes.size} notification schedule(s)`);
  } catch (error) {
    console.error('[Scheduler] Failed to initialize notification schedules:', error);
  }
}

/**
 * 指定時刻に通知ジョブを実行するスケジュールを登録
 */
function registerNotificationSchedule(time: string) {
  const [jstHours, minutes] = time.split(':').map(Number);
  
  // JSTからUTCに変換（9時間引く）
  let utcHours = jstHours - 9;
  if (utcHours < 0) {
    utcHours += 24;
  }
  
  const cronExpr = `${minutes} ${utcHours} * * *`; // 毎日実行
  
  try {
    const spec: schedule.RecurrenceSpecDateRange = {
      rule: cronExpr,
      tz: 'Etc/UTC'
    };
    
    const job = schedule.scheduleJob(spec, async () => {
      console.log(`[Scheduler] Executing notification check at ${time} JST`);
      await runNotificationCheck();
    });
    
    if (job) {
      console.log(`[Scheduler] Registered notification schedule: ${time} JST (${cronExpr} UTC)`);
      const nextExec = job.nextInvocation();
      console.log(`[Scheduler] Next notification check: ${nextExec?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    }
  } catch (error) {
    console.error(`[Scheduler] Failed to register notification schedule for ${time}:`, error);
  }
}

/**
 * デフォルトスケジュール（毎日午前9時）を作成
 */
async function createDefaultSchedule() {
  // この関数は将来的にデータベースにデフォルトスケジュールを挿入する
  // 現在は直接スケジュールを登録
  const defaultSchedule = {
    id: 0, // 仮のID
    name: 'デフォルト（毎日午前9時）',
    scheduleType: 'daily',
    executionTime: '09:00',
    daysOfWeek: null,
    cronExpression: '0 9 * * *', // 毎日午前9時
    enabled: true,
  };
  
  await registerSchedule(defaultSchedule);
  console.log('[Scheduler] Default schedule registered: Daily at 9:00 AM');
}

/**
 * scheduleTypeとexecutionTimeからcron式を生成
 * executionTimeはJST（日本時間）で入力されるため、UTCに変換する
 */
function generateCronExpression(scheduleConfig: {
  scheduleType: string;
  executionTime: string;
  daysOfWeek?: string | null;
}): string {
  const [jstHours, minutes] = scheduleConfig.executionTime.split(':').map(Number);
  
  // JSTからUTCに変換（9時間引く）
  let utcHours = jstHours - 9;
  let dayOffset = 0;
  
  if (utcHours < 0) {
    utcHours += 24;
    dayOffset = -1; // 前日になる
  }
  
  switch (scheduleConfig.scheduleType) {
    case 'daily':
      return `${minutes} ${utcHours} * * *`;
    case 'weekly':
      let days = scheduleConfig.daysOfWeek || '1'; // デフォルトは月曜日
      
      // 日付が前日になる場合、曜日を調整
      if (dayOffset === -1) {
        const dayArray = days.split(',').map(d => {
          let day = parseInt(d.trim());
          day = day - 1;
          if (day < 0) day = 6; // 日曜日(0)の前は土曜日(6)
          return day.toString();
        });
        days = dayArray.join(',');
      }
      
      return `${minutes} ${utcHours} * * ${days}`;
    case 'custom':
      // customの場合はcronExpressionを使用するので、ここには到達しない
      return `${minutes} ${utcHours} * * *`;
    default:
      return `${minutes} ${utcHours} * * *`;
  }
}

/**
 * スケジュールを登録
 */
async function registerSchedule(scheduleConfig: {
  id: number;
  name: string;
  scheduleType: string;
  executionTime: string;
  daysOfWeek?: string | null;
  cronExpression?: string | null;
  enabled: boolean;
}) {
  if (!scheduleConfig.enabled) {
    console.log(`[Scheduler] Schedule "${scheduleConfig.name}" is inactive, skipping`);
    return;
  }
  
  // cron式を生成
  const cronExpr = scheduleConfig.cronExpression || generateCronExpression(scheduleConfig);
  
  // 既存のジョブがあれば削除
  if (activeJobs.has(scheduleConfig.id)) {
    const existingJob = activeJobs.get(scheduleConfig.id);
    existingJob?.cancel();
    activeJobs.delete(scheduleConfig.id);
  }
  
  try {
    // node-scheduleのタイムゾーンをUTCに設定
    const spec: schedule.RecurrenceSpecDateRange = {
      rule: cronExpr,
      tz: 'Etc/UTC'
    };
    
    // ★ キュー経由で実行することで、同時起動を防ぐ
    const job = schedule.scheduleJob(spec, async () => {
      console.log(`[Scheduler] Executing scheduled scraping: ${scheduleConfig.name}`);
      await enqueueScrapingJob(scheduleConfig.id, scheduleConfig.name);
    });
    
    if (job) {
      activeJobs.set(scheduleConfig.id, job);
      console.log(`[Scheduler] Registered schedule: ${scheduleConfig.name} (${cronExpr})`);
      const nextExec = job.nextInvocation();
      console.log(`[Scheduler] Next execution: ${nextExec?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
      
      // 次回実行時刻をデータベースに保存（非同期）
      if (nextExec) {
        updateScheduleSetting(scheduleConfig.id, { nextExecutionAt: nextExec }).catch(err => {
          console.error('[Scheduler] Failed to update nextExecutionAt:', err);
        });
      }
    } else {
      console.error(`[Scheduler] Failed to create job for schedule: ${scheduleConfig.name}`);
    }
  } catch (error) {
    console.error(`[Scheduler] Failed to register schedule "${scheduleConfig.name}":`, error);
  }
}

/**
 * スケジュールされたスクレイピングを実行
 */
async function executeScheduledScraping(scheduleId: number, scheduleName: string) {
  const startTime = Date.now();
  let status: 'success' | 'running' | 'failed' = 'success';
  let errorMessage: string | null = null;
  let itemsCount = 0;
  let newItemsCount = 0;
  
  try {
    console.log(`[Scheduler] Starting scraping for schedule: ${scheduleName}`);
    
    const conditions: SearchConditions = {
      useLatestAnnouncement: true, // 最新公告情報を取得
    };
    
    const result = await scrapeMieBiddings(conditions, false); // 詳細情報は取得しない
    itemsCount = result.items.length;
    
    if (itemsCount > 0) {
      const insertItems = result.items.map(convertToInsertBidding);
      
      // 新規案件検出と保存
      const { newBiddings, updatedBiddings } = await detectNewBiddings(insertItems);
      newItemsCount = newBiddings.length;
      
      console.log(`[Scheduler] Successfully scraped ${itemsCount} items (${newItemsCount} new, ${updatedBiddings.length} updated)`);
    } else {
      console.log('[Scheduler] No items found during scraping');
    }
    
  } catch (error) {
    status = 'failed';
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler] Scraping failed for schedule "${scheduleName}":`, error);
  } finally {
    const duration = Date.now() - startTime;
    
    // スクレイピングログを記録
    try {
      await insertScrapingLog({
        executionType: 'scheduled',
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status,
        itemsScraped: itemsCount,
        newItems: newItemsCount,
        errorMessage,
      });
    } catch (logError) {
      console.error('[Scheduler] Failed to insert scraping log:', logError);
    }
    
    // スケジュール設定のlastExecutedAtを更新
    try {
      await updateScheduleSetting(scheduleId, { lastExecutedAt: new Date() });
      console.log(`[Scheduler] Updated lastExecutedAt for schedule ID: ${scheduleId}`);
    } catch (updateError) {
      console.error('[Scheduler] Failed to update lastExecutedAt:', updateError);
    }
  }
}

/**
 * スケジュールを更新（既存のジョブをキャンセルして新しいジョブを登録）
 */
export async function updateSchedule(scheduleConfig: {
  id: number;
  name: string;
  scheduleType: string;
  executionTime: string;
  daysOfWeek?: string | null;
  cronExpression?: string | null;
  enabled: boolean;
}) {
  console.log(`[Scheduler] Updating schedule: ${scheduleConfig.name}`);
  await registerSchedule(scheduleConfig);
}

/**
 * スケジュールを削除
 */
export function removeSchedule(scheduleId: number) {
  const job = activeJobs.get(scheduleId);
  if (job) {
    job.cancel();
    activeJobs.delete(scheduleId);
    console.log(`[Scheduler] Removed schedule with ID: ${scheduleId}`);
  }
}

/**
 * すべてのスケジュールをキャンセル
 */
export function shutdownScheduler() {
  console.log('[Scheduler] Shutting down all scheduled jobs...');
  activeJobs.forEach((job, id) => {
    job.cancel();
    console.log(`[Scheduler] Cancelled job with ID: ${id}`);
  });
  activeJobs.clear();
  console.log('[Scheduler] Shutdown complete');
}

/**
 * アクティブなスケジュールの情報を取得
 */
export function getActiveScheduleInfo() {
  const info: Array<{ id: number; nextInvocation: Date | null }> = [];
  
  activeJobs.forEach((job, id) => {
    info.push({
      id,
      nextInvocation: job.nextInvocation(),
    });
  });
  
  return info;
}
