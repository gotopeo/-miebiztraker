/**
 * 新規案件検出ロジック
 * 新ロジック仕様に基づく実装（Upsert方式）
 */
import { getDb } from "./db.js";
import { biddings, Bidding, InsertBidding } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { generateTenderCanonicalId, detectTitleChange } from "./tenderIdentity.js";

/**
 * 新規案件を検出して保存（Upsert方式）
 * 
 * 新ロジック仕様：
 * - 新規案件の場合：firstSeenAt, lastSeenAt, version=0, updatedAt=NULL
 * - 既存案件の場合：lastSeenAtを更新
 * - タイトル変更検出時：title, version++, updatedAt=now
 * 
 * @param scrapedBiddings スクレイピングで取得した案件リスト
 * @returns 新規案件と更新案件のリスト
 */
export interface UpdatedBiddingWithChanges {
  old: Bidding;
  new: Bidding;
  changedFields: string[];
  version: number;
}

export async function detectNewBiddings(scrapedBiddings: Partial<InsertBidding>[]): Promise<{
  newBiddings: Bidding[];
  updatedBiddings: UpdatedBiddingWithChanges[];
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  const newBiddings: Bidding[] = [];
  const updatedBiddings: UpdatedBiddingWithChanges[] = [];
  const now = new Date();

  for (const scrapedBidding of scrapedBiddings) {
    // 案件同一性キーを生成
    const tenderCanonicalId = generateTenderCanonicalId(scrapedBidding);

    // DBに既存案件があるかチェック
    const existingBiddings = await db
      .select()
      .from(biddings)
      .where(eq(biddings.tenderCanonicalId, tenderCanonicalId))
      .limit(1);

    if (existingBiddings.length === 0) {
      // 新規案件
      const insertData: InsertBidding = {
        ...scrapedBidding,
        tenderCanonicalId,
        firstSeenAt: now,
        lastSeenAt: now,
        version: 0,
        updatedAt: null,
        caseNumber: scrapedBidding.caseNumber || "",
        title: scrapedBidding.title || "",
      };

      const [inserted] = await db.insert(biddings).values(insertData);
      
      // 挿入したIDで案件を取得
      const [newBidding] = await db
        .select()
        .from(biddings)
        .where(eq(biddings.id, inserted.insertId))
        .limit(1);

      if (newBidding) {
        newBiddings.push(newBidding);
        console.log(`[NewBiddingDetector] New bidding detected: ${tenderCanonicalId} - ${newBidding.title}`);
      }
    } else {
      // 既存案件 - タイトル変更チェック
      const existingBidding = existingBiddings[0];
      
      // タイトル変更判定
      const titleChanged = scrapedBidding.title 
        ? detectTitleChange(existingBidding.title, scrapedBidding.title)
        : false;

      if (titleChanged) {
        // タイトル変更あり → 更新案件として処理
        const newVersion = existingBidding.version + 1;
        
        const updateData: Partial<InsertBidding> = {
          ...scrapedBidding,
          lastSeenAt: now,
          version: newVersion,
          updatedAt: now,
        };

        await db
          .update(biddings)
          .set(updateData)
          .where(eq(biddings.id, existingBidding.id));

        // 更新後の案件を取得
        const [updatedBidding] = await db
          .select()
          .from(biddings)
          .where(eq(biddings.id, existingBidding.id))
          .limit(1);

        if (updatedBidding) {
          updatedBiddings.push({
            old: existingBidding,
            new: updatedBidding,
            changedFields: ["案件名"],
            version: newVersion,
          });
          console.log(`[NewBiddingDetector] Bidding updated: ${tenderCanonicalId} - version ${newVersion}`);
          console.log(`  Old title: ${existingBidding.title}`);
          console.log(`  New title: ${updatedBidding.title}`);
        }
      } else {
        // タイトル変更なし - lastSeenAtのみ更新
        await db
          .update(biddings)
          .set({ lastSeenAt: now })
          .where(eq(biddings.id, existingBidding.id));
      }
    }
  }

  console.log(`[NewBiddingDetector] Summary: ${newBiddings.length} new, ${updatedBiddings.length} updated`);

  return {
    newBiddings,
    updatedBiddings,
  };
}

/**
 * 通知対象の新規案件をフィルタリング
 * 初回通知の場合は最新10件のみに制限
 * 
 * 新ロジック仕様：
 * - max(firstSeenAt, updatedAt) desc でソート
 * - 上位10件のみを通知対象とする
 */
export function filterNewBiddingsForNotification(
  newBiddings: Bidding[],
  isFirstNotification: boolean
): Bidding[] {
  if (!isFirstNotification) {
    return newBiddings;
  }

  // 初回通知の場合は最新10件のみ
  // ソート基準: max(firstSeenAt, updatedAt)
  const sorted = [...newBiddings].sort((a, b) => {
    const aDate = a.updatedAt || a.firstSeenAt;
    const bDate = b.updatedAt || b.firstSeenAt;
    
    if (!aDate || !bDate) return 0;
    return bDate.getTime() - aDate.getTime();
  });

  return sorted.slice(0, 10);
}
