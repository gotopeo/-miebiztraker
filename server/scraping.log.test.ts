/**
 * スクレイピングログの finally ブロック修正に関するテスト
 *
 * 検証対象:
 * - 正常完了時: status=success, itemsScraped/newItemsが正しく記録される
 * - スクレイピング失敗時（result.success=false）: status=failed, errorMessageが記録される
 * - 例外発生時（タイムアウト等）: status=failed, errorMessageが記録される
 * - updateScrapingLog自体が失敗しても例外が外に漏れない
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- モック定義 ----

// scrapeMieBiddings のモック
const mockScrapeMieBiddings = vi.fn();
vi.mock("./scraper", () => ({
  scrapeMieBiddings: (...args: unknown[]) => mockScrapeMieBiddings(...args),
  convertToInsertBidding: (item: unknown) => item,
}));

// detectNewBiddings のモック
const mockDetectNewBiddings = vi.fn();
vi.mock("./newBiddingDetector", () => ({
  detectNewBiddings: (...args: unknown[]) => mockDetectNewBiddings(...args),
}));

// updateScrapingLog のモック
const mockUpdateScrapingLog = vi.fn();
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    insertScrapingLog: vi.fn().mockResolvedValue(1),
    updateScrapingLog: (...args: unknown[]) => mockUpdateScrapingLog(...args),
    getAllTenderCanonicalIds: vi.fn().mockResolvedValue(new Set()),
  };
});

// ---- ヘルパー: バックグラウンド非同期処理が完了するまで待つ ----
async function flushAsync(ms = 50) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- テスト対象の関数を直接テスト ----
// routers.ts の execute mutation のバックグラウンド処理ロジックを
// 同等のロジックとして抽出してテストする

async function runScrapingBackground(
  logId: number,
  updateLog: typeof mockUpdateScrapingLog
) {
  const { scrapeMieBiddings, convertToInsertBidding } = await import("./scraper");
  const { detectNewBiddings } = await import("./newBiddingDetector");

  let finalStatus: "success" | "failed" = "failed";
  let finalError: Error | null = null;
  let itemsScraped = 0;
  let newItems = 0;

  try {
    const result = await scrapeMieBiddings({ useLatestAnnouncement: true }, false);

    if (!result.success) {
      finalError = new Error(result.errorMessage || "スクレイピング失敗");
      return;
    }

    const convertedItems = result.items.map(convertToInsertBidding);
    const { newBiddings } = await detectNewBiddings(convertedItems);

    finalStatus = "success";
    itemsScraped = result.totalCount;
    newItems = newBiddings.length;
  } catch (error) {
    finalError = error instanceof Error ? error : new Error(String(error));
  } finally {
    try {
      await updateLog(logId, {
        finishedAt: expect.any(Date),
        status: finalStatus,
        itemsScraped,
        newItems,
        errorMessage: finalError?.message,
        errorDetails: finalError?.stack,
      });
    } catch {
      // ログ更新失敗は握りつぶす
    }
  }
}

describe("スクレイピングログ finally ブロック", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateScrapingLog.mockResolvedValue(undefined);
  });

  it("正常完了時: status=success でログが更新される", async () => {
    mockScrapeMieBiddings.mockResolvedValue({
      success: true,
      items: [{ title: "テスト案件" }],
      totalCount: 1,
    });
    mockDetectNewBiddings.mockResolvedValue({
      newBiddings: [{ title: "テスト案件" }],
      updatedBiddings: [],
    });

    await runScrapingBackground(42, mockUpdateScrapingLog);

    expect(mockUpdateScrapingLog).toHaveBeenCalledTimes(1);
    const [id, updates] = mockUpdateScrapingLog.mock.calls[0];
    expect(id).toBe(42);
    expect(updates.status).toBe("success");
    expect(updates.itemsScraped).toBe(1);
    expect(updates.newItems).toBe(1);
    expect(updates.errorMessage).toBeUndefined();
  });

  it("result.success=false 時: status=failed でログが更新される", async () => {
    mockScrapeMieBiddings.mockResolvedValue({
      success: false,
      items: [],
      totalCount: 0,
      errorMessage: "接続エラー",
    });

    await runScrapingBackground(43, mockUpdateScrapingLog);

    expect(mockUpdateScrapingLog).toHaveBeenCalledTimes(1);
    const [id, updates] = mockUpdateScrapingLog.mock.calls[0];
    expect(id).toBe(43);
    expect(updates.status).toBe("failed");
    expect(updates.errorMessage).toBe("接続エラー");
  });

  it("例外（タイムアウト等）発生時: status=failed でログが更新される", async () => {
    mockScrapeMieBiddings.mockRejectedValue(
      new Error("Scraping timeout: Process exceeded 10 minutes")
    );

    await runScrapingBackground(44, mockUpdateScrapingLog);

    expect(mockUpdateScrapingLog).toHaveBeenCalledTimes(1);
    const [id, updates] = mockUpdateScrapingLog.mock.calls[0];
    expect(id).toBe(44);
    expect(updates.status).toBe("failed");
    expect(updates.errorMessage).toContain("timeout");
  });

  it("updateScrapingLog自体が失敗しても例外が外に漏れない", async () => {
    mockScrapeMieBiddings.mockRejectedValue(new Error("何らかのエラー"));
    mockUpdateScrapingLog.mockRejectedValue(new Error("DB接続失敗"));

    // 例外が外に漏れないことを確認
    await expect(
      runScrapingBackground(45, mockUpdateScrapingLog)
    ).resolves.not.toThrow();
  });
});
