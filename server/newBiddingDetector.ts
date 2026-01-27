/**
 * 新規案件検出ロジック
 * MVP仕様書 3.4節に基づく実装
 */
import { getDb } from "./db.js";
import { biddings, Bidding, InsertBidding } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { generateTenderCanonicalId, detectChanges } from "./tenderIdentity.js";

/**
 * 新規案件を検出して保存
 * 
 * @param scrapedBiddings スクレイピングで取得した案件リスト
 * @returns 新規案件と更新案件のリスト
 */
export async function detectNewBiddings(scrapedBiddings: Partial<InsertBidding>[]): Promise<{
  newBiddings: Bidding[];
  updatedBiddings: Array<{ old: Bidding; new: Bidding; changedFields: string[] }>;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection failed");
  }

  const newBiddings: Bidding[] = [];
  const updatedBiddings: Array<{ old: Bidding; new: Bidding; changedFields: string[] }> = [];
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
      }
    } else {
      // 既存案件 - 更新チェック
      const existingBidding = existingBiddings[0];
      
      // 差分判定
      const { hasChanges, changedFields } = detectChanges(existingBidding, scrapedBidding);

      if (hasChanges) {
        // 更新あり
        const updateData: Partial<InsertBidding> = {
          ...scrapedBidding,
          lastSeenAt: now,
          lastUpdatedAtSource: scrapedBidding.lastUpdatedAtSource || now,
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
            changedFields,
          });
        }
      } else {
        // 更新なし - last_seen_atのみ更新
        await db
          .update(biddings)
          .set({ lastSeenAt: now })
          .where(eq(biddings.id, existingBidding.id));
      }
    }
  }

  return {
    newBiddings,
    updatedBiddings,
  };
}

/**
 * 通知対象の新規案件をフィルタリング
 * 初回通知の場合は最新10件のみに制限
 */
export function filterNewBiddingsForNotification(
  newBiddings: Bidding[],
  isFirstNotification: boolean
): Bidding[] {
  if (!isFirstNotification) {
    return newBiddings;
  }

  // 初回通知の場合は最新10件のみ
  // ソート基準: publicationDate > updateDate > firstSeenAt
  const sorted = [...newBiddings].sort((a, b) => {
    const aDate = a.publicationDate || a.updateDate || a.firstSeenAt;
    const bDate = b.publicationDate || b.updateDate || b.firstSeenAt;
    
    if (!aDate || !bDate) return 0;
    return bDate.getTime() - aDate.getTime();
  });

  return sorted.slice(0, 10);
}
