import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
 * 発注機関マスターテーブル
 * 三重県の発注機関一覧
 */
export const issuers = mysqlTable("issuers", {
  id: int("id").autoincrement().primaryKey(),
  /** 発注機関名 */
  name: varchar("name", { length: 255 }).notNull(),
  /** 発注機関コード（スクレイピング時の識別用） */
  code: varchar("code", { length: 50 }).unique(),
  /** 分類（例: 「県土整備部」） */
  category: varchar("category", { length: 100 }),
  /** 表示順序 */
  sortOrder: int("sortOrder").default(0).notNull(),
  /** 有効/無効 */
  isActive: boolean("isActive").default(true).notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sortOrderIdx: index("sortOrder_idx").on(table.sortOrder),
  isActiveIdx: index("isActive_idx").on(table.isActive),
}));

export type Issuer = typeof issuers.$inferSelect;
export type InsertIssuer = typeof issuers.$inferInsert;

/**
 * 入札情報テーブル
 * 三重県入札サイトから取得した入札案件情報を保存
 */
export const biddings = mysqlTable("biddings", {
  id: int("id").autoincrement().primaryKey(),
  /** 案件番号（サイト上の一意識別子） */
  caseNumber: varchar("caseNumber", { length: 100 }).notNull(),
  /** 案件同一性キー（新規判定用） */
  tenderCanonicalId: varchar("tenderCanonicalId", { length: 255 }).notNull().unique(),
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
  /** サイトから取得した最終更新日 */
  lastUpdatedAtSource: timestamp("lastUpdatedAtSource"),
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
  /** 初回取得日時（スクレイピングで初めて取得された日時） */
  firstScrapedAt: timestamp("firstScrapedAt"),
  /** システムが初めて観測した日時 */
  firstSeenAt: timestamp("firstSeenAt").notNull(),
  /** システムが最後に観測した日時 */
  lastSeenAt: timestamp("lastSeenAt").notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  caseNumberIdx: index("caseNumber_idx").on(table.caseNumber),
  tenderCanonicalIdIdx: index("tenderCanonicalId_idx").on(table.tenderCanonicalId),
  biddingDateIdx: index("biddingDate_idx").on(table.biddingDate),
  orderOrganCodeIdx: index("orderOrganCode_idx").on(table.orderOrganCode),
  isNewIdx: index("isNew_idx").on(table.isNew),
  firstSeenAtIdx: index("firstSeenAt_idx").on(table.firstSeenAt),
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

/**
 * LINE連携テーブル
 * ユーザーとLINEアカウントの紐付け情報
 */
export const lineConnections = mysqlTable("lineConnections", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull().unique(),
  /** LINE User ID */
  lineUserId: varchar("lineUserId", { length: 100 }).notNull().unique(),
  /** LINE Display Name */
  lineDisplayName: varchar("lineDisplayName", { length: 200 }),
  /** 連携日時 */
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  /** 最終通知送信日時 */
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  lineUserIdIdx: index("lineUserId_idx").on(table.lineUserId),
}));

export type LineConnection = typeof lineConnections.$inferSelect;
export type InsertLineConnection = typeof lineConnections.$inferInsert;

/**
 * LINE認証用ワンタイムコードテーブル
 */
export const lineVerificationCodes = mysqlTable("lineVerificationCodes", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull(),
  /** 6桁の認証コード */
  code: varchar("code", { length: 6 }).notNull().unique(),
  /** 有効期限（発行から30分） */
  expiresAt: timestamp("expiresAt").notNull(),
  /** 使用済みフラグ */
  used: boolean("used").default(false).notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  codeIdx: index("code_idx").on(table.code),
  userIdIdx: index("userId_idx").on(table.userId),
  expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
}));

export type LineVerificationCode = typeof lineVerificationCodes.$inferSelect;
export type InsertLineVerificationCode = typeof lineVerificationCodes.$inferInsert;

/**
 * 通知設定テーブル
 * ユーザーごとの通知条件とスケジュール
 */
export const notificationSubscriptions = mysqlTable("notificationSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull(),
  /** 設定名 */
  name: varchar("name", { length: 200 }).notNull(),
  /** 発注機関コード（カンマ区切り、空の場合は全て） */
  orderOrganCodes: text("orderOrganCodes"),
  /** 発注機関ID（JSON配列、例: [1,5,12]） */
  issuerIds: text("issuerIds"),
  /** 工種/委託種別（"工事", "委託", "両方"） */
  projectType: varchar("projectType", { length: 50 }),
  /** 公告日フィルター（日数、例: 7 = 過去7日間） */
  publicationDateDays: int("publicationDateDays"),
  /** 更新日フィルター（日数、例: 3 = 過去3日間） */
  updateDateDays: int("updateDateDays"),
  /** キーワード（カンマ区切り） */
  keywords: text("keywords"),
  /** 格付フィルター（カンマ区切り） */
  ratings: varchar("ratings", { length: 100 }),
  /** 予定価格最小値 */
  estimatedPriceMin: decimal("estimatedPriceMin", { precision: 15, scale: 2 }),
  /** 予定価格最大値 */
  estimatedPriceMax: decimal("estimatedPriceMax", { precision: 15, scale: 2 }),
  /** 通知時刻（カンマ区切り、例: "08:00,12:00,17:00"） */
  notificationTimes: varchar("notificationTimes", { length: 200 }).notNull(),
  /** 初回通知済みフラグ */
  isFirstNotificationSent: boolean("isFirstNotificationSent").default(false).notNull(),
  /** 更新通知を有効にする */
  enableUpdateNotification: boolean("enableUpdateNotification").default(false).notNull(),
  /** 有効/無効 */
  enabled: boolean("enabled").default(true).notNull(),
  /** 最終通知日時 */
  lastNotifiedAt: timestamp("lastNotifiedAt"),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  /** 更新日時 */
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  enabledIdx: index("enabled_idx").on(table.enabled),
}));

export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type InsertNotificationSubscription = typeof notificationSubscriptions.$inferInsert;

/**
 * 通知履歴テーブル
 */
export const notificationLogs = mysqlTable("notificationLogs", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーID */
  userId: int("userId").notNull(),
  /** 通知設定ID */
  subscriptionId: int("subscriptionId").notNull(),
  /** 通知した案件の同一性キー */
  tenderCanonicalId: varchar("tenderCanonicalId", { length: 255 }).notNull(),
  /** 通知タイプ（NEW: 新規, UPDATE: 更新） */
  notificationType: mysqlEnum("notificationType", ["NEW", "UPDATE"]).notNull(),
  /** 通知した案件数 */
  biddingCount: int("biddingCount").notNull(),
  /** 通知した案件ID（カンマ区切り） */
  biddingIds: text("biddingIds"),
  /** 通知ステータス（success, failed） */
  status: mysqlEnum("status", ["success", "failed"]).notNull(),
  /** エラーメッセージ */
  errorMessage: text("errorMessage"),
  /** 送信日時 */
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  /** 通知メッセージ内容 */
  messageContent: text("messageContent"),
  /** 通知日時 */
  notifiedAt: timestamp("notifiedAt").defaultNow().notNull(),
  /** 作成日時 */
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("userId_idx").on(table.userId),
  subscriptionIdIdx: index("subscriptionId_idx").on(table.subscriptionId),
  notifiedAtIdx: index("notifiedAt_idx").on(table.notifiedAt),
  // 重複防止用のユニークインデックス
  uniqueNotificationIdx: uniqueIndex("unique_notification_idx").on(
    table.userId,
    table.subscriptionId,
    table.tenderCanonicalId,
    table.notificationType
  ),
}));

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;
