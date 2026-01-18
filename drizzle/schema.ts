import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 入札情報テーブル
 * 三重県入札サイトから取得した入札案件情報を保存
 */
export const biddings = mysqlTable("biddings", {
  id: int("id").autoincrement().primaryKey(),
  /** 案件番号（サイト上の一意識別子） */
  caseNumber: varchar("caseNumber", { length: 100 }).notNull(),
  /** 案件名・工事名 */
  title: text("title").notNull(),
  /** 発注機関コード */
  orderOrganCode: varchar("orderOrganCode", { length: 50 }),
  /** 発注機関名 */
  orderOrganName: text("orderOrganName"),
  /** 入札日時 */
  biddingDate: timestamp("biddingDate"),
  /** 開札日時 */
  openingDate: timestamp("openingDate"),
  /** 予定価格（円） */
  estimatedPrice: decimal("estimatedPrice", { precision: 15, scale: 2 }),
  /** 最低制限価格（円） */
  minimumPrice: decimal("minimumPrice", { precision: 15, scale: 2 }),
  /** 入札方式 */
  biddingMethod: varchar("biddingMethod", { length: 100 }),
  /** 工事種別 */
  constructionType: varchar("constructionType", { length: 100 }),
  /** 工事場所 */
  location: text("location"),
  /** 工期 */
  constructionPeriod: varchar("constructionPeriod", { length: 200 }),
  /** 格付（A/B/C/D/指定なし） */
  rating: varchar("rating", { length: 50 }),
  /** 参加申請期間 */
  applicationPeriod: varchar("applicationPeriod", { length: 200 }),
  /** 参加申請締切日 */
  applicationDeadline: timestamp("applicationDeadline"),
  /** 質問有無 */
  hasQuestion: varchar("hasQuestion", { length: 10 }),
  /** 公告日 */
  publicationDate: timestamp("publicationDate"),
  /** 更新日 */
  updateDate: timestamp("updateDate"),
  /** 履行場所（詳細） */
  performLocation: text("performLocation"),
  /** 備考 */
  remarks: text("remarks"),
  /** 入札状態（公告中、入札済み、中止等） */
  status: varchar("status", { length: 50 }),
  /** 詳細ページURL */
  detailUrl: text("detailUrl"),
  /** 元データ（JSON形式で保存） */
  rawData: text("rawData"),
  /** 新規フラグ（通知用） */
  isNew: boolean("isNew").default(true).notNull(),
  /** 通知済みフラグ */
  notified: boolean("notified").default(false).notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  caseNumberIdx: index("caseNumber_idx").on(table.caseNumber),
  biddingDateIdx: index("biddingDate_idx").on(table.biddingDate),
  orderOrganCodeIdx: index("orderOrganCode_idx").on(table.orderOrganCode),
  isNewIdx: index("isNew_idx").on(table.isNew),
}));

export type Bidding = typeof biddings.$inferSelect;
export type InsertBidding = typeof biddings.$inferInsert;

/**
 * スクレイピング実行履歴テーブル
 */
export const scrapingLogs = mysqlTable("scrapingLogs", {
  id: int("id").autoincrement().primaryKey(),
  /** 実行ユーザーID（手動実行の場合） */
  userId: int("userId"),
  /** 実行タイプ（manual: 手動, scheduled: スケジュール） */
  executionType: mysqlEnum("executionType", ["manual", "scheduled"]).notNull(),
  /** 実行開始時刻 */
  startedAt: timestamp("startedAt").notNull(),
  /** 実行終了時刻 */
  finishedAt: timestamp("finishedAt"),
  /** 実行ステータス（running, success, failed） */
  status: mysqlEnum("status", ["running", "success", "failed"]).notNull(),
  /** 取得件数 */
  itemsScraped: int("itemsScraped").default(0),
  /** 新規件数 */
  newItems: int("newItems").default(0),
  /** エラーメッセージ */
  errorMessage: text("errorMessage"),
  /** エラー詳細（スタックトレース等） */
  errorDetails: text("errorDetails"),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  startedAtIdx: index("startedAt_idx").on(table.startedAt),
  statusIdx: index("status_idx").on(table.status),
}));

export type ScrapingLog = typeof scrapingLogs.$inferSelect;
export type InsertScrapingLog = typeof scrapingLogs.$inferInsert;

/**
 * キーワード監視設定テーブル
 * ユーザーごとに監視したいキーワードを登録
 */
export const keywordWatches = mysqlTable("keywordWatches", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull(),
  /** 監視キーワード */
  keyword: varchar("keyword", { length: 200 }).notNull(),
  /** 有効/無効 */
  enabled: boolean("enabled").default(true).notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
}));

export type KeywordWatch = typeof keywordWatches.$inferSelect;
export type InsertKeywordWatch = typeof keywordWatches.$inferInsert;

/**
 * スケジュール設定テーブル
 * 自動スクレイピングのスケジュール設定
 */
export const scheduleSettings = mysqlTable("scheduleSettings", {
  id: int("id").autoincrement().primaryKey(),
  /** 設定名 */
  name: varchar("name", { length: 100 }).notNull(),
  /** スケジュールタイプ（daily: 日次, weekly: 週次, custom: カスタム） */
  scheduleType: mysqlEnum("scheduleType", ["daily", "weekly", "custom"]).notNull(),
  /** 実行時刻（HH:mm形式） */
  executionTime: varchar("executionTime", { length: 5 }).notNull(),
  /** 週次の場合の曜日（0=日曜, 6=土曜、カンマ区切り） */
  daysOfWeek: varchar("daysOfWeek", { length: 20 }),
  /** カスタムcron式 */
  cronExpression: varchar("cronExpression", { length: 100 }),
  /** 有効/無効 */
  enabled: boolean("enabled").default(true).notNull(),
  /** 最終実行日時 */
  lastExecutedAt: timestamp("lastExecutedAt"),
  /** 次回実行予定日時 */
  nextExecutionAt: timestamp("nextExecutionAt"),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleSetting = typeof scheduleSettings.$inferSelect;
export type InsertScheduleSetting = typeof scheduleSettings.$inferInsert;

/**
 * 検索条件履歴テーブル
 * ユーザーが実行した検索条件を保存
 */
export const searchHistory = mysqlTable("searchHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull(),
  /** 検索条件名 */
  name: varchar("name", { length: 200 }),
  /** 発注区分（電子入札/紙入札） */
  orderType: varchar("orderType", { length: 50 }),
  /** 入札方式 */
  biddingMethod: varchar("biddingMethod", { length: 100 }),
  /** 区分（工事/委託） */
  projectType: varchar("projectType", { length: 50 }),
  /** 種別コード（カンマ区切り） */
  categoryCodes: text("categoryCodes"),
  /** 格付（カンマ区切り） */
  rating: varchar("rating", { length: 100 }),
  /** 発注機関コード */
  organizationCode: varchar("organizationCode", { length: 100 }),
  /** 履行場所 */
  location: varchar("location", { length: 200 }),
  /** 公告日（From） */
  publicationDateFrom: timestamp("publicationDateFrom"),
  /** 公告日（To） */
  publicationDateTo: timestamp("publicationDateTo"),
  /** 予定価格（最小） */
  estimatedPriceMin: decimal("estimatedPriceMin", { precision: 15, scale: 2 }),
  /** 予定価格（最大） */
  estimatedPriceMax: decimal("estimatedPriceMax", { precision: 15, scale: 2 }),
  /** 件名キーワード */
  titleKeyword: varchar("titleKeyword", { length: 200 }),
  /** 施工番号 */
  constructionNo: varchar("constructionNo", { length: 50 }),
  /** 使用回数 */
  useCount: int("useCount").default(1).notNull(),
  /** 最終使用日時 */
  lastUsedAt: timestamp("lastUsedAt").defaultNow().notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  lastUsedAtIdx: index("lastUsedAt_idx").on(table.lastUsedAt),
}));

export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = typeof searchHistory.$inferInsert;
