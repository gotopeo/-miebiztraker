import { 
  getActiveNotificationSubscriptions, 
  getLineConnectionByUserId,
  searchBiddings,
  insertNotificationLog,
  updateNotificationSubscription,
  getAlreadySentNotifications
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
  const isFirstNotification = !subscription.isFirstNotificationSent;
  const enableUpdateNotification = subscription.enableUpdateNotification || false;
  
  if (subscription.lastNotifiedAt) {
    filters.createdAtFrom = new Date(subscription.lastNotifiedAt);
  } else {
    // 初回実行の場合は過去24時間
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    filters.createdAtFrom = yesterday;
  }

  // 案件を検索
  let biddings = await searchBiddings({
    ...filters,
    limit: isFirstNotification ? 10 : 50, // 初回は10件、通常は50件
    offset: 0,
  });

  // 初回通知の場合、最新10件に制限（公告日降順）
  if (isFirstNotification && biddings.length > 0) {
    biddings = biddings
      .sort((a, b) => {
        const aDate = a.publicationDate || a.updateDate || a.createdAt;
        const bDate = b.publicationDate || b.updateDate || b.createdAt;
        if (!aDate || !bDate) return 0;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 10);
  }

  console.log(`[Notification Job] Found ${biddings.length} matching biddings for subscription ${subscription.id}`);

  if (biddings.length === 0) {
    // 新着案件がない場合もlastNotifiedAtを更新
    await updateNotificationSubscription(subscription.id, {
      lastNotifiedAt: new Date(),
    });
    return;
  }

  // 重複チェック: 既に通知済みの案件を除外
  const tenderCanonicalIds = biddings
    .map(b => b.tenderCanonicalId)
    .filter((id): id is string => !!id);
  
  const alreadySent = await getAlreadySentNotifications(
    subscription.userId,
    subscription.id,
    tenderCanonicalIds
  );

  // 未通知の案件のみにフィルタリング
  const newBiddings = biddings.filter(b => 
    b.tenderCanonicalId && !alreadySent.includes(b.tenderCanonicalId)
  );

  console.log(`[Notification Job] ${newBiddings.length} new biddings after duplicate check (filtered ${alreadySent.length} duplicates)`);

  if (newBiddings.length === 0) {
    // 重複除外後に新着案件がない場合
    await updateNotificationSubscription(subscription.id, {
      lastNotifiedAt: new Date(),
    });
    return;
  }

  // LINE通知を送信
  try {
    const message = formatNotificationMessage(subscription.name, newBiddings);
    await sendLineTextMessage(lineConnection.lineUserId, message);

    // 通知履歴を記録（個別に記録して重複防止）
    for (const bidding of newBiddings) {
      if (bidding.tenderCanonicalId) {
        await insertNotificationLog({
          userId: subscription.userId,
          subscriptionId: subscription.id,
          tenderCanonicalId: bidding.tenderCanonicalId,
          notificationType: "NEW",
          biddingCount: 1,
          biddingIds: bidding.id.toString(),
          status: "success",
        });
      }
    }

    // 最終通知日時と初回通知フラグを更新
    await updateNotificationSubscription(subscription.id, {
      lastNotifiedAt: new Date(),
      isFirstNotificationSent: true,
    });

    console.log(`[Notification Job] Successfully sent notification to user ${subscription.userId}`);
  } catch (error) {
    console.error(`[Notification Job] Failed to send notification:`, error);

    // エラーを記録（バッチで記録）
    await insertNotificationLog({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      tenderCanonicalId: newBiddings.map((b) => b.tenderCanonicalId || b.id.toString()).join(","),
      notificationType: "NEW",
      biddingCount: newBiddings.length,
      biddingIds: newBiddings.map((b) => b.id).join(","),
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // 更新通知が有効な場合、更新案件をチェック
  if (enableUpdateNotification) {
    await processUpdateNotifications(subscription, lineConnection, filters);
  }
}

/**
 * 更新通知を処理
 */
async function processUpdateNotifications(
  subscription: any,
  lineConnection: any,
  filters: any
): Promise<void> {
  console.log(`[Notification Job] Checking for updated biddings for subscription ${subscription.id}`);

  // 更新案件を検索（最終通知日時以降に更新された案件）
  const updatedFilters = {
    ...filters,
    lastUpdatedAtFrom: subscription.lastNotifiedAt || new Date(Date.now() - 24 * 60 * 60 * 1000),
    limit: 50,
    offset: 0,
  };

  const updatedBiddings = await searchBiddings(updatedFilters);

  console.log(`[Notification Job] Found ${updatedBiddings.length} potentially updated biddings`);

  if (updatedBiddings.length === 0) {
    return;
  }

  // 重複チェック: 既に更新通知済みの案件を除外
  const tenderCanonicalIds = updatedBiddings
    .map(b => b.tenderCanonicalId)
    .filter((id): id is string => !!id);
  
  const alreadySentUpdates = await getAlreadySentNotifications(
    subscription.userId,
    subscription.id,
    tenderCanonicalIds,
    "UPDATE"
  );

  // 未通知の更新案件のみにフィルタリング
  const newUpdates = updatedBiddings.filter(b => 
    b.tenderCanonicalId && !alreadySentUpdates.includes(b.tenderCanonicalId)
  );

  console.log(`[Notification Job] ${newUpdates.length} new updates after duplicate check`);

  if (newUpdates.length === 0) {
    return;
  }

  // 更新通知を送信
  try {
    const message = formatUpdateNotificationMessage(subscription.name, newUpdates);
    await sendLineTextMessage(lineConnection.lineUserId, message);

    // 通知履歴を記録
    for (const bidding of newUpdates) {
      if (bidding.tenderCanonicalId) {
        await insertNotificationLog({
          userId: subscription.userId,
          subscriptionId: subscription.id,
          tenderCanonicalId: bidding.tenderCanonicalId,
          notificationType: "UPDATE",
          biddingCount: 1,
          biddingIds: bidding.id.toString(),
          status: "success",
        });
      }
    }

    console.log(`[Notification Job] Successfully sent update notification to user ${subscription.userId}`);
  } catch (error) {
    console.error(`[Notification Job] Failed to send update notification:`, error);

    // エラーを記録
    await insertNotificationLog({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      tenderCanonicalId: newUpdates.map((b) => b.tenderCanonicalId || b.id.toString()).join(","),
      notificationType: "UPDATE",
      biddingCount: newUpdates.length,
      biddingIds: newUpdates.map((b) => b.id).join(","),
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

/**
 * 更新通知メッセージをフォーマット
 */
function formatUpdateNotificationMessage(subscriptionName: string, biddings: any[]): string {
  let message = `📢 【${subscriptionName}】案件更新通知\n\n`;
  message += `入札案件が ${biddings.length} 件更新されました。\n\n`;

  // 最大5件まで表示
  const displayBiddings = biddings.slice(0, 5);

  for (const bidding of displayBiddings) {
    message += `━━━━━━━━━━━━━━\n`;
    message += `📄 ${bidding.title}\n`;
    
    if (bidding.orderOrganName) {
      message += `🏢 ${bidding.orderOrganName}\n`;
    }
    
    if (bidding.applicationDeadline) {
      message += `📅 締切日: ${new Date(bidding.applicationDeadline).toLocaleDateString("ja-JP")}\n`;
    }
    
    if (bidding.estimatedPrice) {
      const price = parseFloat(bidding.estimatedPrice);
      message += `💰 予定価格: ${price.toLocaleString()}円\n`;
    }
    
    message += `\n`;
  }

  if (biddings.length > 5) {
    message += `\n他 ${biddings.length - 5} 件の更新があります。\n`;
  }

  message += `\n詳細はWebサイトでご確認ください。`;

  return message;
}
