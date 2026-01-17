import { eq, desc, and, like, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
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
  InsertScheduleSetting
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

  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(biddings);

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
        await db.insert(biddings).values(bidding);
        saved++;
      } else {
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
 * スケジュール設定を挿入
 */
export async function insertScheduleSetting(setting: InsertScheduleSetting): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(scheduleSettings).values(setting);
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
