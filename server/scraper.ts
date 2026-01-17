import { Builder, By, until, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { InsertBidding, biddings as biddingsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * 三重県入札情報サイトのスクレイパー
 * フレームセット構造とセッション管理に対応
 */

const MIE_BIDDING_URL = "https://mie.efftis.jp/24000/ppi/pub";

export interface ScraperResult {
  success: boolean;
  itemsScraped: number;
  newItems: number;
  biddings: InsertBidding[];
  error?: string;
  errorDetails?: string;
}

/**
 * Seleniumでスクレイピングを実行
 */
export async function scrapeMieBiddingSite(): Promise<ScraperResult> {
  let driver: WebDriver | null = null;

  try {
    // Chrome オプションの設定
    const options = new chrome.Options();
    options.addArguments("--headless"); // ヘッドレスモード
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");

    // WebDriverの初期化
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    console.log("[Scraper] Starting scraping process...");

    // 親ページにアクセス（セッション確立）
    await driver.get(MIE_BIDDING_URL);
    console.log("[Scraper] Accessed parent page");

    // ページの読み込みを待機
    await driver.wait(until.elementLocated(By.css("frameset, frame")), 10000);

    // フレームを取得
    const frames = await driver.findElements(By.css("frame"));
    console.log(`[Scraper] Found ${frames.length} frames`);

    if (frames.length === 0) {
      throw new Error("No frames found on the page");
    }

    // 検索フォームがあるフレームに切り替え（通常2番目のフレーム）
    // フレーム名が "post" または src に "PPI0102" が含まれるものを探す
    let targetFrameIndex = -1;
    for (let i = 0; i < frames.length; i++) {
      const frameName = await frames[i].getAttribute("name");
      const frameSrc = await frames[i].getAttribute("src");
      console.log(`[Scraper] Frame ${i}: name="${frameName}", src="${frameSrc}"`);

      if (frameName === "post" || frameSrc.includes("PPI0102")) {
        targetFrameIndex = i;
        break;
      }
    }

    if (targetFrameIndex === -1) {
      // デフォルトで2番目のフレームを使用
      targetFrameIndex = Math.min(1, frames.length - 1);
    }

    console.log(`[Scraper] Switching to frame ${targetFrameIndex}`);
    await driver.switchTo().frame(targetFrameIndex);

    // フォームの読み込みを待機
    await driver.wait(
      until.elementLocated(By.css('form, input[type="text"], button, input[type="submit"]')),
      10000
    );

    console.log("[Scraper] Form loaded successfully");

    // 検索条件を入力（すべての案件を取得するため、条件は空または広範囲に設定）
    // 発注機関コードなどのフィールドがあれば設定可能
    // ここでは検索ボタンをそのまま押して全件取得を試みる

    // 検索ボタンを探して実行
    const searchButton = await driver.findElement(
      By.css('button[type="submit"], input[type="submit"], button:contains("検索")')
    );
    await searchButton.click();
    console.log("[Scraper] Search button clicked");

    // 結果の読み込みを待機
    await driver.sleep(3000); // 結果表示を待つ

    // 結果テーブルを取得
    const resultTable = await driver.findElement(By.css("table"));
    const rows = await resultTable.findElements(By.css("tbody tr"));

    console.log(`[Scraper] Found ${rows.length} result rows`);

    const biddings: InsertBidding[] = [];

    // 各行をパース
    for (let i = 0; i < rows.length; i++) {
      try {
        const cells = await rows[i].findElements(By.css("td"));
        if (cells.length < 3) continue; // データ行でない場合はスキップ

        // セルのテキストを取得
        const cellTexts = await Promise.all(
          cells.map((cell) => cell.getText())
        );

        // データ構造は実際のサイトに応じて調整が必要
        // 仮の構造：[案件番号, 案件名, 発注機関, 入札日, ...]
        const bidding: InsertBidding = {
          caseNumber: cellTexts[0] || "",
          title: cellTexts[1] || "",
          orderOrganName: cellTexts[2] || "",
          biddingDate: cellTexts[3] ? new Date(cellTexts[3]) : undefined,
          status: cellTexts[4] || "公告中",
          rawData: JSON.stringify(cellTexts),
          isNew: true,
          notified: false,
        };

        biddings.push(bidding);
      } catch (error) {
        console.error(`[Scraper] Error parsing row ${i}:`, error);
      }
    }

    console.log(`[Scraper] Successfully scraped ${biddings.length} items`);

    return {
      success: true,
      itemsScraped: biddings.length,
      newItems: biddings.length, // 新規判定はDB側で行う
      biddings,
    };
  } catch (error) {
    console.error("[Scraper] Error during scraping:", error);
    return {
      success: false,
      itemsScraped: 0,
      newItems: 0,
      biddings: [],
      error: error instanceof Error ? error.message : String(error),
      errorDetails: error instanceof Error ? error.stack : undefined,
    };
  } finally {
    // WebDriverをクリーンアップ
    if (driver) {
      try {
        await driver.quit();
        console.log("[Scraper] WebDriver closed");
      } catch (error) {
        console.error("[Scraper] Error closing WebDriver:", error);
      }
    }
  }
}

/**
 * スクレイピング結果をデータベースに保存
 * 重複チェックを行い、新規のみ保存
 */
export async function saveBiddingsToDb(
  biddings: InsertBidding[],
  db: any
): Promise<{ saved: number; duplicates: number }> {
  let saved = 0;
  let duplicates = 0;

  for (const bidding of biddings) {
    try {
      // 案件番号で重複チェック
      const existing = await db
        .select()
        .from(biddingsTable)
        .where(eq(biddingsTable.caseNumber, bidding.caseNumber))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(biddingsTable).values(bidding);
        saved++;
      } else {
        duplicates++;
      }
    } catch (error) {
      console.error(
        `[Scraper] Error saving bidding ${bidding.caseNumber}:`,
        error
      );
    }
  }

  return { saved, duplicates };
}
