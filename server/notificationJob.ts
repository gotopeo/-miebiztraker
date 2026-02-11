import { 
  getActiveNotificationSubscriptions, 
  getLineConnectionByUserId,
  updateNotificationSubscription,
  getDb
} from "./db";
import { sendLineTextMessage } from "./_core/line";
import { biddings, notificationLogs, Bidding } from "../drizzle/schema";
import { and, eq, gt, lte, inArray, sql } from "drizzle-orm";
import { matchesKeywords } from "./tenderIdentity";

/**
 * 通知チェックジョブを実行
 * 全ての有効な通知設定をチェックし、条件に一致する新着案件を通知
 */
export async function runNotificationCheck(): Promise<void> {
  console.log("[Notification Job] Starting notification check...");

  try {
    // 有効な通知設定を全て取得
    const subscriptions = await getActiveNotificationSubscriptions();
    
    if (subscriptions.length === 0) {
      console.log("[Notification Job] No active subscriptions found");
      return;
    }

    console.log(`[Notification Job] Found ${subscriptions.length} active subscriptions`);

    // 各通知設定を処理
    for (const subscription of subscriptions) {
      try {
        await processSubscription(subscription);
      } catch (error) {
        console.error(`[Notification Job] Failed to process subscription ${subscription.id}:`, error);
      }
    }

    console.log("[Notification Job] Notification check completed");
  } catch (error) {
    console.error("[Notification Job] Error during notification check:", error);
  }
}

/**
 * 個別の通知設定を処理（新ロジック仕様：時間窓方式）
 */
async function processSubscription(subscription: any): Promise<void> {
  console.log(`[Notification Job] Processing subscription ${subscription.id}: ${subscription.name}`);

  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  // LINE連携を確認
  const lineConnection = await getLineConnectionByUserId(subscription.userId);
  
  if (!lineConnection) {
    console.log(`[Notification Job] User ${subscription.userId} has no LINE connection, skipping`);
    return;
  }

  // 時間窓の設定
  const since = subscription.lastNotifiedAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // 初回は過去24時間
  const until = new Date();
  // isFirstNotificationSentは使用しない（lastNotifiedAtで制御）

  console.log(`[Notification Job] Time window: ${since.toISOString()} to ${until.toISOString()}`);

  // 新規候補を取得：firstSeenAt > since AND firstSeenAt <= until
  const newCandidates = await db
    .select()
    .from(biddings)
    .where(
      and(
        gt(biddings.firstSeenAt, since),
        lte(biddings.firstSeenAt, until)
      )
    );

  console.log(`[Notification Job] Found ${newCandidates.length} new candidates`);

  // 更新候補を取得：updatedAt > since AND updatedAt <= until
  const updateCandidates = await db
    .select()
    .from(biddings)
    .where(
      and(
        sql`${biddings.updatedAt} IS NOT NULL`,
        gt(biddings.updatedAt, since),
        lte(biddings.updatedAt, until)
      )
    );

  console.log(`[Notification Job] Found ${updateCandidates.length} update candidates`);

  // new優先ルール：同一tenderCanonicalIdがnewとupdateの両方に該当する場合、newのみ通知
  const newCanonicalIds = new Set(newCandidates.map(b => b.tenderCanonicalId));
  const filteredUpdateCandidates = updateCandidates.filter(b => !newCanonicalIds.has(b.tenderCanonicalId));

  console.log(`[Notification Job] After new-priority rule: ${filteredUpdateCandidates.length} update candidates`);

  // フィルタリング
  const filteredNew = await applyFilters(newCandidates, subscription);
  const filteredUpdate = await applyFilters(filteredUpdateCandidates, subscription);

  console.log(`[Notification Job] After filtering: ${filteredNew.length} new, ${filteredUpdate.length} updates`);

  // 初回通知抑制ロジックを削除（設定作成時にlastNotifiedAtを設定するため、古い案件が通知されることはない）
  let finalNew = filteredNew;

  // 重複チェック
  const finalNewAfterDuplicateCheck = await removeDuplicates(finalNew, subscription.userId, subscription.id, "NEW", db);
  const finalUpdateAfterDuplicateCheck = await removeDuplicates(filteredUpdate, subscription.userId, subscription.id, "UPDATE", db);

  console.log(`[Notification Job] After duplicate check: ${finalNewAfterDuplicateCheck.length} new, ${finalUpdateAfterDuplicateCheck.length} updates`);

  // 通知送信
  if (finalNewAfterDuplicateCheck.length > 0) {
    await sendNotification(finalNewAfterDuplicateCheck, subscription, lineConnection, "NEW", db);
  }

  if (finalUpdateAfterDuplicateCheck.length > 0) {
    await sendNotification(finalUpdateAfterDuplicateCheck, subscription, lineConnection, "UPDATE", db);
  }

  // last_notified_atを更新
  await updateNotificationSubscription(subscription.id, {
    lastNotifiedAt: until,
  });

  console.log(`[Notification Job] Subscription ${subscription.id} processed successfully`);
}

/**
 * フィルタリング処理
 */
async function applyFilters(candidates: Bidding[], subscription: any): Promise<Bidding[]> {
  let filtered = candidates;

  // 発注機関フィルター（発注機関名ベース）
  if (subscription.orderOrganNames) {
    const names = subscription.orderOrganNames.split(",").map((n: string) => n.trim());
    filtered = filtered.filter(b => b.orderOrganName && names.includes(b.orderOrganName));
  }

  // 工事種別フィルター（projectTypeまたはkeywordsを使用、OR部分一致）
  const projectTypeFilter = subscription.projectType || subscription.keywords;
  if (projectTypeFilter) {
    const types = projectTypeFilter.split(",").map((k: string) => k.trim());
    filtered = filtered.filter(b => matchesKeywords(b.constructionType || "", types));
  }

  return filtered;
}

/**
 * 重複チェック
 */
async function removeDuplicates(
  candidates: Bidding[],
  userId: number,
  subscriptionId: number,
  notificationType: "NEW" | "UPDATE",
  db: any
): Promise<Bidding[]> {
  if (candidates.length === 0) return [];

  const tenderCanonicalIds = candidates.map(b => b.tenderCanonicalId);

  if (notificationType === "NEW") {
    // NEW通知の重複チェック
    const alreadySent = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          eq(notificationLogs.subscriptionId, subscriptionId),
          inArray(notificationLogs.tenderCanonicalId, tenderCanonicalIds),
          eq(notificationLogs.notificationType, "NEW")
        )
      );

    const sentIds = new Set(alreadySent.map((log: any) => log.tenderCanonicalId));
    return candidates.filter(b => !sentIds.has(b.tenderCanonicalId));
  } else {
    // UPDATE通知の重複チェック（バージョン含む）
    const alreadySent = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.userId, userId),
          eq(notificationLogs.subscriptionId, subscriptionId),
          inArray(notificationLogs.tenderCanonicalId, tenderCanonicalIds),
          eq(notificationLogs.notificationType, "UPDATE")
        )
      );

    // (tenderCanonicalId, version)の組み合わせで重複チェック
    const sentKeys = new Set(
      alreadySent.map((log: any) => `${log.tenderCanonicalId}-${log.tenderVersion}`)
    );
    return candidates.filter(b => !sentKeys.has(`${b.tenderCanonicalId}-${b.version}`));
  }
}

/**
 * 通知送信
 */
async function sendNotification(
  biddings: Bidding[],
  subscription: any,
  lineConnection: any,
  notificationType: "NEW" | "UPDATE",
  db: any
): Promise<void> {
  try {
    const message = formatNotificationMessage(subscription.name, biddings, notificationType);
    await sendLineTextMessage(lineConnection.lineUserId, message);

    // 通知履歴を記録
    for (const bidding of biddings) {
      await db.insert(notificationLogs).values({
        userId: subscription.userId,
        subscriptionId: subscription.id,
        tenderCanonicalId: bidding.tenderCanonicalId,
        notificationType: notificationType,
        tenderVersion: notificationType === "UPDATE" ? bidding.version : null,
        biddingCount: 1,
        biddingIds: bidding.id.toString(),
        status: "success",
        messageContent: message.substring(0, 500), // 最初の500文字のみ保存
      });
    }

    console.log(`[Notification Job] Successfully sent ${notificationType} notification: ${biddings.length} items`);
  } catch (error) {
    console.error(`[Notification Job] Failed to send ${notificationType} notification:`, error);

    // エラーを記録
    await db.insert(notificationLogs).values({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      tenderCanonicalId: biddings.map(b => b.tenderCanonicalId).join(","),
      notificationType: notificationType,
      tenderVersion: null,
      biddingCount: biddings.length,
      biddingIds: biddings.map(b => b.id).join(","),
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * 通知メッセージをフォーマット
 */
function formatNotificationMessage(subscriptionName: string, biddings: Bidding[], notificationType: "NEW" | "UPDATE"): string {
  const typeLabel = notificationType === "NEW" ? "新着" : "更新";
  let message = `📢 【${subscriptionName}】\n\n`;
  message += `${typeLabel}入札情報が ${biddings.length} 件あります。\n\n`;

  // 最大5件まで表示
  const displayBiddings = biddings.slice(0, 5);

  for (const bidding of displayBiddings) {
    message += `━━━━━━━━━━━━━━\n`;
    message += `📄 ${bidding.title}\n`;
    
    if (bidding.orderOrganName) {
      message += `🏢 ${bidding.orderOrganName}\n`;
    }
    
    if (bidding.caseNumber) {
      message += `🔖 案件番号: ${bidding.caseNumber}\n`;
    }
    
    if (notificationType === "UPDATE" && bidding.version) {
      message += `🔄 バージョン: ${bidding.version}\n`;
    }
    
    if (bidding.applicationDeadline) {
      message += `📅 締切日: ${new Date(bidding.applicationDeadline).toLocaleDateString("ja-JP")}\n`;
    }
    
    if (bidding.estimatedPrice) {
      const price = parseFloat(bidding.estimatedPrice.toString());
      message += `💰 予定価格: ${price.toLocaleString()}円\n`;
    }
    
    message += `\n`;
  }

  if (biddings.length > 5) {
    message += `\n他 ${biddings.length - 5} 件の案件があります。\n`;
  }

  message += `\n詳細はWebサイトでご確認ください。`;

  return message;
}
