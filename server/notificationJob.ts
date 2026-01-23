import { 
  getActiveNotificationSubscriptions, 
  getLineConnectionByUserId,
  searchBiddings,
  insertNotificationLog,
  updateNotificationSubscription
} from "./db";
import { sendLineTextMessage } from "./_core/line";

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
 * 個別の通知設定を処理
 */
async function processSubscription(subscription: any): Promise<void> {
  console.log(`[Notification Job] Processing subscription ${subscription.id}: ${subscription.name}`);

  // LINE連携を確認
  const lineConnection = await getLineConnectionByUserId(subscription.userId);
  
  if (!lineConnection) {
    console.log(`[Notification Job] User ${subscription.userId} has no LINE connection, skipping`);
    return;
  }

  // フィルター条件を構築
  const filters: any = {};

  // 発注機関コード
  if (subscription.orderOrganCodes) {
    filters.orderOrganCodes = subscription.orderOrganCodes.split(",").map((c: string) => c.trim());
  }

  // 公告日フィルター（過去N日間）
  if (subscription.publicationDateDays) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - subscription.publicationDateDays);
    filters.publicationDateFrom = daysAgo;
  }

  // 更新日フィルター（過去N日間）
  if (subscription.updateDateDays) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - subscription.updateDateDays);
    filters.updateDateFrom = daysAgo;
  }

  // キーワード
  if (subscription.keywords) {
    filters.keywords = subscription.keywords.split(",").map((k: string) => k.trim());
  }

  // 格付
  if (subscription.ratings) {
    filters.ratings = subscription.ratings.split(",").map((r: string) => r.trim());
  }

  // 予定価格
  if (subscription.estimatedPriceMin) {
    filters.estimatedPriceMin = parseFloat(subscription.estimatedPriceMin);
  }
  if (subscription.estimatedPriceMax) {
    filters.estimatedPriceMax = parseFloat(subscription.estimatedPriceMax);
  }

  // 新着案件のみ（最終通知日時以降）
  if (subscription.lastNotifiedAt) {
    filters.createdAtFrom = new Date(subscription.lastNotifiedAt);
  } else {
    // 初回実行の場合は過去24時間
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    filters.createdAtFrom = yesterday;
  }

  // 案件を検索
  const biddings = await searchBiddings({
    ...filters,
    limit: 50, // 最大50件
    offset: 0,
  });

  console.log(`[Notification Job] Found ${biddings.length} matching biddings for subscription ${subscription.id}`);

  if (biddings.length === 0) {
    // 新着案件がない場合もlastNotifiedAtを更新
    await updateNotificationSubscription(subscription.id, {
      lastNotifiedAt: new Date(),
    });
    return;
  }

  // LINE通知を送信
  try {
    const message = formatNotificationMessage(subscription.name, biddings);
    await sendLineTextMessage(lineConnection.lineUserId, message);

    // 通知履歴を記録
    await insertNotificationLog({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      biddingCount: biddings.length,
      biddingIds: biddings.map((b) => b.id).join(","),
      status: "success",
    });

    // 最終通知日時を更新
    await updateNotificationSubscription(subscription.id, {
      lastNotifiedAt: new Date(),
    });

    console.log(`[Notification Job] Successfully sent notification to user ${subscription.userId}`);
  } catch (error) {
    console.error(`[Notification Job] Failed to send notification:`, error);

    // エラーを記録
    await insertNotificationLog({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      biddingCount: biddings.length,
      biddingIds: biddings.map((b) => b.id).join(","),
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * 通知メッセージをフォーマット
 */
function formatNotificationMessage(subscriptionName: string, biddings: any[]): string {
  let message = `📢 【${subscriptionName}】\n\n`;
  message += `新着入札情報が ${biddings.length} 件あります。\n\n`;

  // 最大5件まで表示
  const displayBiddings = biddings.slice(0, 5);

  for (const bidding of displayBiddings) {
    message += `━━━━━━━━━━━━━━\n`;
    message += `📄 ${bidding.title}\n`;
    
    if (bidding.orderOrganName) {
      message += `🏢 ${bidding.orderOrganName}\n`;
    }
    
    if (bidding.biddingDate) {
      message += `📅 入札日: ${new Date(bidding.biddingDate).toLocaleDateString("ja-JP")}\n`;
    }
    
    if (bidding.estimatedPrice) {
      const price = parseFloat(bidding.estimatedPrice);
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
