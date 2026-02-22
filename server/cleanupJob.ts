/**
 * DB肥大化対策クリーンアップジョブ
 * 新ロジック仕様：方式A（TTL削除 + 件数上限削除）
 * + タイムアウトしたスクレイピングログのクリーンアップ
 */
import { getDb } from "./db.js";
import { biddings, scrapingLogs } from "../drizzle/schema.js";
import { lt, sql, asc, eq, and } from "drizzle-orm";

// 保持期間（日数）
const RETENTION_DAYS = 180;

// 最大件数
const MAX_TENDERS = 20000;

/**
 * クリーンアップジョブを実行
 * 毎日03:00に実行される想定
 */
export async function runCleanupJob(): Promise<void> {
  console.log("[Cleanup Job] Starting database cleanup...");

  const db = await getDb();
  if (!db) {
    console.error("[Cleanup Job] Database connection failed");
    return;
  }

  try {
    // TTL削除（主）
    await ttlDeletion(db);

    // 件数上限削除（保険）
    await countLimitDeletion(db);

    // タイムアウトしたスクレイピングログのクリーンアップ
    await cleanupStuckScrapingLogs(db);

    console.log("[Cleanup Job] Database cleanup completed successfully");
  } catch (error) {
    console.error("[Cleanup Job] Error during cleanup:", error);
  }
}

/**
 * TTL削除：lastSeenAt < now - 180日 の案件を削除
 */
async function ttlDeletion(db: any): Promise<void> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);

  console.log(`[Cleanup Job] TTL deletion: removing biddings with lastSeenAt < ${retentionDate.toISOString()}`);

  const result = await db
    .delete(biddings)
    .where(lt(biddings.lastSeenAt, retentionDate));

  const deletedCount = result.affectedRows || 0;
  console.log(`[Cleanup Job] TTL deletion: removed ${deletedCount} old biddings`);
}

/**
 * 件数上限削除：20,000件を超えたら古い順に削除
 */
async function countLimitDeletion(db: any): Promise<void> {
  // 現在の件数を取得
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(biddings);

  const currentCount = countResult[0]?.count || 0;
  console.log(`[Cleanup Job] Current biddings count: ${currentCount}`);

  if (currentCount <= MAX_TENDERS) {
    console.log(`[Cleanup Job] Count limit deletion: no action needed (${currentCount} <= ${MAX_TENDERS})`);
    return;
  }

  const excess = currentCount - MAX_TENDERS;
  console.log(`[Cleanup Job] Count limit deletion: need to remove ${excess} biddings`);

  // lastSeenAtが古い順にID を取得
  const oldestBiddings = await db
    .select({ id: biddings.id })
    .from(biddings)
    .orderBy(asc(biddings.lastSeenAt))
    .limit(excess);

  if (oldestBiddings.length === 0) {
    console.log("[Cleanup Job] Count limit deletion: no biddings to remove");
    return;
  }

  const idsToDelete = oldestBiddings.map((b: any) => b.id);

  // バッチ削除（1000件ずつ）
  const batchSize = 1000;
  let deletedTotal = 0;

  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const batch = idsToDelete.slice(i, i + batchSize);
    const result = await db
      .delete(biddings)
      .where(sql`${biddings.id} IN (${sql.join(batch.map((id: number) => sql`${id}`), sql`, `)})`);
    
    deletedTotal += result.affectedRows || 0;
  }

  console.log(`[Cleanup Job] Count limit deletion: removed ${deletedTotal} biddings`);
}

/**
 * タイムアウトしたスクレイピングログのクリーンアップ
 * 10分以上「実行中」のままのログを「失敗」に更新
 */
async function cleanupStuckScrapingLogs(db: any): Promise<void> {
  console.log("[Cleanup Job] Cleaning up stuck scraping logs...");

  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  try {
    const result = await db
      .update(scrapingLogs)
      .set({
        status: "failed",
        errorMessage: "Process terminated or timeout (automatically cleaned up)",
        finishedAt: new Date(),
      })
      .where(
        and(
          eq(scrapingLogs.status, "running"),
          lt(scrapingLogs.startedAt, tenMinutesAgo)
        )
      );

    const updatedCount = result.affectedRows || 0;
    console.log(`[Cleanup Job] Cleaned up ${updatedCount} stuck scraping logs`);
  } catch (error) {
    console.error("[Cleanup Job] Error cleaning up stuck scraping logs:", error);
  }
}
