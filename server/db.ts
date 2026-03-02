import { eq, desc, and, like, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  issuers,
  Issuer,
  InsertIssuer,
  biddings,
  Bidding,
  InsertBidding,
  scrapingLogs,
  ScrapingLog,
  InsertScrapingLog,
  keywordWatches,
  KeywordWatch,
  InsertKeywordWatch,
  scheduleSettings,
  ScheduleSetting,
  InsertScheduleSetting,
  lineConnections,
  LineConnection,
  InsertLineConnection,
  lineVerificationCodes,
  LineVerificationCode,
  InsertLineVerificationCode,
  notificationSubscriptions,
  NotificationSubscription,
  InsertNotificationSubscription,
  notificationLogs,
  NotificationLog,
  InsertNotificationLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * 全ユーザー一覧を取得（管理者用）
 */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(desc(users.createdAt));
}

/**
 * ユーザーIDでユーザーを取得
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * システム統計情報を取得（管理者用）
 */
export async function getSystemStats() {
  const db = await getDb();
  if (!db) return {
    totalUsers: 0,
    lineConnectedUsers: 0,
    totalNotificationSettings: 0,
    totalBiddings: 0,
  };

  const [usersCount, lineConnectionsCount, notificationSettingsCount, biddingsCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(lineConnections),
    db.select({ count: sql<number>`count(*)` }).from(notificationSubscriptions),
    db.select({ count: sql<number>`count(*)` }).from(biddings),
  ]);

  return {
    totalUsers: Number(usersCount[0]?.count || 0),
    lineConnectedUsers: Number(lineConnectionsCount[0]?.count || 0),
    totalNotificationSettings: Number(notificationSettingsCount[0]?.count || 0),
    totalBiddings: Number(biddingsCount[0]?.count || 0),
  };
}

// ===== 入札情報関連 =====

/**
 * 入札情報を検索（フィルタリング・ページネーション対応）
 */
export async function searchBiddings(params: {
  keyword?: string;
  orderOrganCode?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  newItemsFilter?: "24h" | "7d" | "30d";
  limit?: number;
  offset?: number;
}): Promise<Bidding[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (params.keyword) {
    conditions.push(like(biddings.title, `%${params.keyword}%`));
  }

  if (params.orderOrganCode) {
    conditions.push(eq(biddings.orderOrganCode, params.orderOrganCode));
  }

  if (params.startDate) {
    conditions.push(gte(biddings.biddingDate, params.startDate));
  }

  if (params.endDate) {
    conditions.push(lte(biddings.biddingDate, params.endDate));
  }

  if (params.status) {
    conditions.push(eq(biddings.status, params.status));
  }

  if (params.newItemsFilter) {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (params.newItemsFilter) {
      case "24h":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    conditions.push(gte(biddings.firstScrapedAt, cutoffDate));
  }

  let query = db
    .select()
    .from(biddings)
    .orderBy(desc(biddings.biddingDate));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  if (params.limit) {
    query = query.limit(params.limit) as any;
  }

  if (params.offset) {
    query = query.offset(params.offset) as any;
  }

  return await query;
}

/**
 * 入札情報の総件数を取得
 */
export async function countBiddings(params: {
  keyword?: string;
  orderOrganCode?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  newItemsFilter?: "24h" | "7d" | "30d";
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions = [];

  if (params.keyword) {
    conditions.push(like(biddings.title, `%${params.keyword}%`));
  }

  if (params.orderOrganCode) {
    conditions.push(eq(biddings.orderOrganCode, params.orderOrganCode));
  }

  if (params.startDate) {
    conditions.push(gte(biddings.biddingDate, params.startDate));
  }

  if (params.endDate) {
    conditions.push(lte(biddings.biddingDate, params.endDate));
  }

  if (params.status) {
    conditions.push(eq(biddings.status, params.status));
  }

  if (params.newItemsFilter) {
    const now = new Date();
    let cutoffDate: Date;
    
    switch (params.newItemsFilter) {
      case "24h":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    conditions.push(gte(biddings.firstScrapedAt, cutoffDate));
  }

  let query = db.select({ count: sql<number>`count(*)` }).from(biddings);

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }

  const result = await query;
  return result[0]?.count || 0;
}

/**
 * 入札情報をIDで取得
 */
export async function getBiddingById(id: number): Promise<Bidding | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(biddings).where(eq(biddings.id, id)).limit(1);
  return result[0];
}

/**
 * 入札情報を挿入
 */
export async function insertBidding(bidding: InsertBidding): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(biddings).values(bidding);
}

/**
 * 入札情報を一括挿入（重複チェック付き）
 */
export async function insertBiddingsBatch(
  biddingList: InsertBidding[]
): Promise<{ saved: number; duplicates: number }> {
  const db = await getDb();
  if (!db) return { saved: 0, duplicates: 0 };

  let saved = 0;
  let duplicates = 0;

  for (const bidding of biddingList) {
    try {
      const existing = await db
        .select()
        .from(biddings)
        .where(eq(biddings.caseNumber, bidding.caseNumber))
        .limit(1);

      if (existing.length === 0) {
        // 新規案件の場合、firstScrapedAtを設定
        await db.insert(biddings).values({
          ...bidding,
          firstScrapedAt: new Date(),
        });
        saved++;
      } else {
        // 既存案件の場合、情報を更新（firstScrapedAtは保持）
        const updateData: any = { ...bidding };
        delete updateData.caseNumber; // キーフィールドは更新しない
        delete updateData.firstScrapedAt; // 初回取得日時は保持
        
        await db
          .update(biddings)
          .set(updateData)
          .where(eq(biddings.caseNumber, bidding.caseNumber));
        duplicates++;
      }
    } catch (error) {
      console.error(`[DB] Error inserting bidding ${bidding.caseNumber}:`, error);
    }
  }

  return { saved, duplicates };
}

// ===== スクレイピングログ関連 =====

/**
 * スクレイピングログを挿入
 */
export async function insertScrapingLog(log: InsertScrapingLog): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.insert(scrapingLogs).values(log);
  return result[0]?.insertId || 0;
}

/**
 * スクレイピングログを更新
 */
export async function updateScrapingLog(
  id: number,
  updates: Partial<InsertScrapingLog>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(scrapingLogs).set(updates).where(eq(scrapingLogs.id, id));
}

/**
 * スクレイピングログを取得
 */
export async function getScrapingLogs(limit: number = 50): Promise<ScrapingLog[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(scrapingLogs)
    .orderBy(desc(scrapingLogs.startedAt))
    .limit(limit);
}

// ===== キーワード監視関連 =====

/**
 * ユーザーのキーワード監視設定を取得
 */
export async function getKeywordWatchesByUser(userId: number): Promise<KeywordWatch[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(keywordWatches)
    .where(eq(keywordWatches.userId, userId))
    .orderBy(desc(keywordWatches.createdAt));
}

/**
 * キーワード監視を追加
 */
export async function insertKeywordWatch(watch: InsertKeywordWatch): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(keywordWatches).values(watch);
}

/**
 * キーワード監視を削除
 */
export async function deleteKeywordWatch(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(keywordWatches).where(eq(keywordWatches.id, id));
}

/**
 * キーワード監視を更新
 */
export async function updateKeywordWatch(
  id: number,
  updates: Partial<InsertKeywordWatch>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(keywordWatches).set(updates).where(eq(keywordWatches.id, id));
}

// ===== スケジュール設定関連 =====

/**
 * すべてのスケジュール設定を取得
 */
export async function getScheduleSettings(): Promise<ScheduleSetting[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(scheduleSettings).orderBy(desc(scheduleSettings.createdAt));
}

/**
 * アクティブなスケジュール設定を取得
 */
export async function getActiveSchedules(): Promise<ScheduleSetting[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(scheduleSettings).where(eq(scheduleSettings.enabled, true));
}

/**
 * スケジュール設定を挿入
 */
export async function insertScheduleSetting(setting: InsertScheduleSetting): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(scheduleSettings).values(setting);
  // MySQLはinsertId、SQLiteはlastInsertRowidを返す
  const insertId = (result as any).insertId ?? (result as any).lastInsertRowid ?? null;
  return insertId ? Number(insertId) : null;
}

/**
 * スケジュール設定を更新
 */
export async function updateScheduleSetting(
  id: number,
  updates: Partial<InsertScheduleSetting>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(scheduleSettings).set(updates).where(eq(scheduleSettings.id, id));
}

/**
 * スケジュール設定を削除
 */
export async function deleteScheduleSetting(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(scheduleSettings).where(eq(scheduleSettings.id, id));
}

// ==================== LINE連携関連 ====================

/**
 * LINE連携情報を取得（ユーザーIDから）
 */
export async function getLineConnectionByUserId(userId: number): Promise<LineConnection | null> {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select().from(lineConnections).where(eq(lineConnections.userId, userId)).limit(1);
  return results[0] || null;
}

/**
 * LINE連携情報を取得（LINE User IDから）
 */
export async function getLineConnectionByLineUserId(lineUserId: string): Promise<LineConnection | null> {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select().from(lineConnections).where(eq(lineConnections.lineUserId, lineUserId)).limit(1);
  return results[0] || null;
}

/**
 * LINE連携情報を作成
 */
export async function insertLineConnection(connection: InsertLineConnection): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(lineConnections).values(connection);
}

/**
 * LINE連携情報を削除
 */
export async function deleteLineConnection(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(lineConnections).where(eq(lineConnections.userId, userId));
}

/**
 * LINE連携の最終通知日時を更新
 */
export async function updateLineConnectionLastNotified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(lineConnections)
    .set({ lastNotifiedAt: new Date() })
    .where(eq(lineConnections.userId, userId));
}

// ==================== ワンタイムコード関連 ====================

/**
 * ワンタイムコードを生成して保存
 */
export async function createVerificationCode(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 6桁のランダムコードを生成
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 有効期限は30分後
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await db.insert(lineVerificationCodes).values({
    userId,
    code,
    expiresAt,
    used: false,
  });

  return code;
}

/**
 * ワンタイムコードを検証
 */
export async function verifyCode(code: string): Promise<{ valid: boolean; userId?: number }> {
  const db = await getDb();
  if (!db) return { valid: false };

  const results = await db.select()
    .from(lineVerificationCodes)
    .where(
      and(
        eq(lineVerificationCodes.code, code),
        eq(lineVerificationCodes.used, false),
        gte(lineVerificationCodes.expiresAt, new Date())
      )
    )
    .limit(1);

  if (results.length === 0) {
    return { valid: false };
  }

  const verificationCode = results[0];

  // コードを使用済みにする
  await db.update(lineVerificationCodes)
    .set({ used: true })
    .where(eq(lineVerificationCodes.id, verificationCode.id));

  return { valid: true, userId: verificationCode.userId };
}

/**
 * ユーザーの未使用コードを削除
 */
export async function deleteUserVerificationCodes(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(lineVerificationCodes).where(eq(lineVerificationCodes.userId, userId));
}

// ==================== 通知設定関連 ====================

/**
 * ユーザーの通知設定一覧を取得
 */
export async function getNotificationSubscriptions(userId: number): Promise<NotificationSubscription[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.userId, userId))
    .orderBy(desc(notificationSubscriptions.createdAt));
}

/**
 * 有効な通知設定を全て取得
 */
export async function getActiveNotificationSubscriptions(): Promise<NotificationSubscription[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(notificationSubscriptions)
    .where(eq(notificationSubscriptions.enabled, true));
}

/**
 * 通知設定を作成
 */
export async function insertNotificationSubscription(subscription: InsertNotificationSubscription): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notificationSubscriptions).values(subscription);
  return Number(result[0].insertId);
}

/**
 * 通知設定を更新
 */
export async function updateNotificationSubscription(
  id: number,
  updates: Partial<InsertNotificationSubscription>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(notificationSubscriptions)
    .set(updates)
    .where(eq(notificationSubscriptions.id, id));
}

/**
 * 通知設定を削除
 */
export async function deleteNotificationSubscription(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(notificationSubscriptions).where(eq(notificationSubscriptions.id, id));
}

// ==================== 通知履歴関連 ====================

/**
 * 通知履歴を記録
 */
export async function insertNotificationLog(log: InsertNotificationLog): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(notificationLogs).values(log);
}

/**
 * ユーザーの通知履歴を取得
 */
export async function getNotificationLogs(userId: number, limit: number = 50): Promise<NotificationLog[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(notificationLogs)
    .where(eq(notificationLogs.userId, userId))
    .orderBy(desc(notificationLogs.notifiedAt))
    .limit(limit);
}

/**
 * 通知履歴の重複チェック
 * @param userId ユーザーID
 * @param subscriptionId 通知設定ID
 * @param tenderCanonicalId 案件同一性キー
 * @returns 既に通知済みの場合true
 */
export async function isNotificationAlreadySent(
  userId: number,
  subscriptionId: number,
  tenderCanonicalId: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const results = await db.select()
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.userId, userId),
        eq(notificationLogs.subscriptionId, subscriptionId),
        eq(notificationLogs.tenderCanonicalId, tenderCanonicalId)
      )
    )
    .limit(1);

  return results.length > 0;
}

/**
 * 複数案件の重複チェック（バッチ処理用）
 * @param userId ユーザーID
 * @param subscriptionId 通知設定ID
 * @param tenderCanonicalIds 案件同一性キーの配列
 * @returns 通知済みの案件同一性キーの配列
 */
export async function getAlreadySentNotifications(
  userId: number,
  subscriptionId: number,
  tenderCanonicalIds: string[],
  notificationType?: string
): Promise<string[]> {
  const db = await getDb();
  if (!db || tenderCanonicalIds.length === 0) return [];

  const conditions = [
    eq(notificationLogs.userId, userId),
    eq(notificationLogs.subscriptionId, subscriptionId),
    sql`${notificationLogs.tenderCanonicalId} IN (${sql.join(tenderCanonicalIds.map(id => sql`${id}`), sql`, `)})`
  ];

  if (notificationType) {
    conditions.push(sql`${notificationLogs.notificationType} = ${notificationType}`);
  }

  const results = await db.select()
    .from(notificationLogs)
    .where(and(...conditions));

  return results.map(log => log.tenderCanonicalId);
}

// ==================== 発注機関マスター関連 ====================

/**
 * 全ての発注機関を取得（表示順でソート）
 */
export async function getAllIssuers(): Promise<Issuer[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(issuers)
    .where(eq(issuers.isActive, true))
    .orderBy(issuers.sortOrder);
}

/**
 * IDで発注機関を取得
 */
export async function getIssuerById(id: number): Promise<Issuer | null> {
  const db = await getDb();
  if (!db) return null;

  const results = await db.select()
    .from(issuers)
    .where(eq(issuers.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * 複数IDで発注機関を取得
 */
export async function getIssuersByIds(ids: number[]): Promise<Issuer[]> {
  const db = await getDb();
  if (!db || ids.length === 0) return [];

  return await db.select()
    .from(issuers)
    .where(sql`${issuers.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
}
