import * as schedule from 'node-schedule';
import { scrapeMieBiddings, convertToInsertBidding, type SearchConditions } from './scraper';
import { insertBiddingsBatch, insertScrapingLog, getActiveSchedules, updateScheduleSetting } from './db';

/**
 * スケジューラーサービス
 * データベースに保存されたスケジュール設定に基づいて、定期的にスクレイピングを実行する
 */

// アクティブなスケジュールジョブを管理
const activeJobs = new Map<number, schedule.Job>();

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
      return;
    }
    
    for (const scheduleConfig of schedules) {
      registerSchedule(scheduleConfig);
    }
    
    console.log(`[Scheduler] Initialized with ${schedules.length} active schedule(s)`);
  } catch (error) {
    console.error('[Scheduler] Failed to initialize:', error);
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
    
    const job = schedule.scheduleJob(spec, async () => {
      console.log(`[Scheduler] Executing scheduled scraping: ${scheduleConfig.name}`);
      await executeScheduledScraping(scheduleConfig.id, scheduleConfig.name);
    });
    
    if (job) {
      activeJobs.set(scheduleConfig.id, job);
      console.log(`[Scheduler] Registered schedule: ${scheduleConfig.name} (${cronExpr})`);
      const nextExec = job.nextInvocation();
      console.log(`[Scheduler] Next execution: ${nextExec?.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
      
      // 次回実行時刻をデータベースに保存（非同期）
      // nextExecはUTCのため、JSTに変換して保存
      if (nextExec) {
        // UTCの時刻をJSTに変換（9時間足す）
        const jstNextExec = new Date(nextExec.getTime() + 9 * 60 * 60 * 1000);
        updateScheduleSetting(scheduleConfig.id, { nextExecutionAt: jstNextExec }).catch(err => {
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
  
  try {
    console.log(`[Scheduler] Starting scraping for schedule: ${scheduleName}`);
    
    const conditions: SearchConditions = {
      useLatestAnnouncement: true, // 最新公告情報を取得
    };
    
    const result = await scrapeMieBiddings(conditions, false); // 詳細情報は取得しない
    itemsCount = result.items.length;
    
    if (itemsCount > 0) {
      const insertItems = result.items.map(convertToInsertBidding);
      await insertBiddingsBatch(insertItems);
      console.log(`[Scheduler] Successfully scraped and saved ${itemsCount} items`);
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
        newItems: 0, // TODO: 新規件数をカウントするロジックを追加
        errorMessage,
      });
    } catch (logError) {
      console.error('[Scheduler] Failed to insert scraping log:', logError);
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
