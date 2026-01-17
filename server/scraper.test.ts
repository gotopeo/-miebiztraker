import { describe, expect, it } from "vitest";
import { scrapeMieBiddingSite } from "./scraper";

/**
 * スクレイピング機能のテスト
 * 
 * 注意: このテストは実際のWebサイトにアクセスするため、
 * ネットワーク接続とSelenium環境が必要です。
 */

describe("scraper", () => {
  it("should return a valid scraper result structure", async () => {
    // スクレイピング実行（タイムアウトを長めに設定）
    const result = await scrapeMieBiddingSite();

    // 結果の構造を検証
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("itemsScraped");
    expect(result).toHaveProperty("newItems");
    expect(result).toHaveProperty("biddings");
    expect(Array.isArray(result.biddings)).toBe(true);

    // 成功時の検証
    if (result.success) {
      expect(result.itemsScraped).toBeGreaterThanOrEqual(0);
      expect(result.newItems).toBeGreaterThanOrEqual(0);
      expect(result.biddings.length).toBe(result.itemsScraped);

      // 各入札情報の構造を検証
      if (result.biddings.length > 0) {
        const firstBidding = result.biddings[0];
        expect(firstBidding).toHaveProperty("caseNumber");
        expect(firstBidding).toHaveProperty("title");
        expect(firstBidding).toHaveProperty("isNew");
        expect(firstBidding).toHaveProperty("notified");
      }
    } else {
      // 失敗時の検証
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    }
  }, 120000); // タイムアウト: 120秒
});
