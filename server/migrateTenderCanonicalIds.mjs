/**
 * 既存データ移行スクリプト
 * 既存案件のtenderCanonicalIdを新形式（案件番号ベース）に再生成
 */
import { drizzle } from "drizzle-orm/mysql2";
import { mysqlTable, int, varchar, text, timestamp, boolean, decimal, index } from "drizzle-orm/mysql-core";
import { eq } from "drizzle-orm";

// biddingsテーブルの定義（スキーマからコピー）
const biddings = mysqlTable("biddings", {
  id: int("id").autoincrement().primaryKey(),
  caseNumber: varchar("caseNumber", { length: 100 }).notNull(),
  tenderCanonicalId: varchar("tenderCanonicalId", { length: 255 }).notNull().unique(),
  title: text("title").notNull(),
  orderOrganCode: varchar("orderOrganCode", { length: 50 }),
  orderOrganName: text("orderOrganName"),
  detailUrl: text("detailUrl"),
  version: int("version").default(0).notNull(),
  updatedAt: timestamp("updatedAt"),
  firstSeenAt: timestamp("firstSeenAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").notNull(),
});

// データベース接続
const db = drizzle(process.env.DATABASE_URL);

/**
 * 文字列を正規化（全角半角統一、空白統一、大小文字統一）
 */
function normalizeString(str) {
  if (!str) return "";
  
  return str
    // 全角英数字を半角に変換
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    // 全角スペースを半角に変換
    .replace(/　/g, " ")
    // 連続する空白を1つに
    .replace(/\s+/g, " ")
    // 前後の空白を削除
    .trim()
    // 小文字に統一
    .toLowerCase();
}

/**
 * 案件同一性キー（tender_canonical_id）を生成（新形式）
 */
function generateTenderCanonicalId(bidding) {
  // 案件番号が存在する場合
  if (bidding.caseNumber) {
    // 発注機関コードがある場合は組み合わせて一意性を保証
    if (bidding.orderOrganCode) {
      return `${normalizeString(bidding.orderOrganCode)}-${normalizeString(bidding.caseNumber)}`;
    }
    // 案件番号のみの場合
    return normalizeString(bidding.caseNumber);
  }

  // 案件番号が取得できない場合（エラーケース）
  // 詳細URLをフォールバックとして使用
  if (bidding.detailUrl) {
    return `url-${normalizeString(bidding.detailUrl)}`;
  }

  // 最終手段：案件名＋発注機関名
  const fallbackKey = `${normalizeString(bidding.orderOrganName || "")}-${normalizeString(bidding.title || "")}`;
  return `fallback-${fallbackKey}`;
}

/**
 * メイン処理
 */
async function main() {
  console.log("[Migration] Starting tenderCanonicalId migration...");

  try {
    // 全案件を取得
    const allBiddings = await db.select().from(biddings);
    console.log(`[Migration] Found ${allBiddings.length} biddings to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const bidding of allBiddings) {
      try {
        // 新しいtenderCanonicalIdを生成
        const newCanonicalId = generateTenderCanonicalId(bidding);

        // 既に新形式の場合はスキップ
        if (bidding.tenderCanonicalId === newCanonicalId) {
          skippedCount++;
          continue;
        }

        // 更新
        await db
          .update(biddings)
          .set({
            tenderCanonicalId: newCanonicalId,
            version: 0, // バージョンを0に初期化
            updatedAt: null, // updatedAtをnullに設定
          })
          .where(eq(biddings.id, bidding.id));

        updatedCount++;

        if (updatedCount % 100 === 0) {
          console.log(`[Migration] Progress: ${updatedCount} updated, ${skippedCount} skipped`);
        }
      } catch (error) {
        console.error(`[Migration] Error updating bidding ID ${bidding.id}:`, error);
        errorCount++;
      }
    }

    console.log("[Migration] Migration completed");
    console.log(`[Migration] Summary: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
  } catch (error) {
    console.error("[Migration] Fatal error:", error);
    process.exit(1);
  }
}

// 実行
main().then(() => {
  console.log("[Migration] Script finished");
  process.exit(0);
}).catch((error) => {
  console.error("[Migration] Script failed:", error);
  process.exit(1);
});
