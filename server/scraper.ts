import { Builder, By, until, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { InsertBidding, biddings as biddingsTable } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * 三重県入札情報サイトのスクレイパー
 * 実際のサイト構造に完全対応（最終版）
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
    options.addArguments("--headless");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");

    // ChromeDriver 128を使用
    const service = new chrome.ServiceBuilder('/usr/local/bin/chromedriver-128');

    // WebDriverの初期化
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .setChromeService(service)
      .build();

    console.log("[Scraper] Starting scraping process...");

    // 検索ページにアクセス
    await driver.get(MIE_BIDDING_URL);
    console.log("[Scraper] Accessed search page");

    // ページの読み込みを待機
    await driver.wait(until.elementLocated(By.id("searchBtn")), 15000);
    console.log("[Scraper] Search form loaded");

    // 最新公告情報ボタンをJavaScriptで実行
    await driver.executeScript("LinkSubmit('P004','4','searchBtn');");
    console.log("[Scraper] Latest bidding info button clicked");

    // 結果テーブルの表示を十分に待機
    await driver.sleep(8000);
    console.log("[Scraper] Waiting for result table...");

    // すべてのテーブルを取得
    const tables = await driver.findElements(By.css("table"));
    console.log(`[Scraper] Found ${tables.length} tables`);

    if (tables.length === 0) {
      return {
        success: false,
        itemsScraped: 0,
        newItems: 0,
        biddings: [],
        error: "No tables found on page",
      };
    }

    // 結果テーブルを特定（ヘッダー行に「案件名称」を含むテーブル）
    let resultTable = null;
    
    for (const table of tables) {
      try {
        const firstRow = await table.findElement(By.css("tr"));
        const headerText = await firstRow.getText();
        
        if (headerText.includes("案件名称") && headerText.includes("発注機関")) {
          resultTable = table;
          console.log("[Scraper] Found result table with header:", headerText.substring(0, 100));
          break;
        }
      } catch (error) {
        // このテーブルにはtr要素がない、次へ
        continue;
      }
    }

    if (!resultTable) {
      console.log("[Scraper] Result table not found, using largest table as fallback");
      // フォールバック: 最も行数が多いテーブルを使用
      let maxRows = 0;
      for (const table of tables) {
        const rows = await table.findElements(By.css("tr"));
        if (rows.length > maxRows) {
          maxRows = rows.length;
          resultTable = table;
        }
      }
    }

    if (!resultTable) {
      return {
        success: false,
        itemsScraped: 0,
        newItems: 0,
        biddings: [],
        error: "Could not identify result table",
      };
    }

    const rows = await resultTable.findElements(By.css("tr"));
    console.log(`[Scraper] Found ${rows.length} rows in result table`);

    const biddings: InsertBidding[] = [];

    // ヘッダー行をスキップして各行をパース
    for (let i = 1; i < rows.length; i++) {
      try {
        const cells = await rows[i].findElements(By.css("td, th"));
        
        if (cells.length < 9) {
          console.log(`[Scraper] Row ${i} has only ${cells.length} cells, skipping`);
          continue;
        }

        // セルのテキストを取得
        const cellTexts = await Promise.all(
          cells.map((cell) => cell.getText())
        );

        // 空行をスキップ
        const no = cellTexts[0]?.trim();
        if (!no || no === "") {
          continue;
        }

        console.log(`[Scraper] Row ${i}: No=${no}, Organ=${cellTexts[1]?.substring(0, 30)}`);

        // データ構造:
        // 0: No
        // 1: 発注機関施行番号（連結、例: "伊勢建設事務所50705317"）
        // 2: 質問有無
        // 3: 案件名称
        // 4: 入札方式等
        // 5: 種別
        // 6: 格付
        // 7: 参加申請期間
        // 8: 受付状況

        // 発注機関と施行番号を分割（数字8桁を施行番号として抽出）
        const organAndNumber = (cellTexts[1] || "").trim();
        const numberMatch = organAndNumber.match(/(\d{8})$/);
        const caseNumber = numberMatch ? numberMatch[1] : "";
        const orderOrganName = numberMatch 
          ? organAndNumber.substring(0, organAndNumber.length - 8)
          : organAndNumber;

        // 案件名称
        const title = (cellTexts[3] || "").trim();

        // 参加申請期間から日付を抽出
        const applicationPeriod = (cellTexts[7] || "").trim();
        const biddingDate = parseApplicationPeriod(applicationPeriod);

        const bidding: InsertBidding = {
          caseNumber,
          title,
          orderOrganName,
          biddingMethod: (cellTexts[4] || "").trim(),
          constructionType: (cellTexts[5] || "").trim(),
          location: (cellTexts[6] || "").trim(), // 格付
          constructionPeriod: applicationPeriod,
          biddingDate,
          status: (cellTexts[8] || "公告中").trim(),
          rawData: JSON.stringify(cellTexts),
          isNew: true,
          notified: false,
        };

        // 案件番号と案件名が存在する場合のみ追加
        if (bidding.caseNumber && bidding.title) {
          biddings.push(bidding);
        } else {
          console.log(`[Scraper] Row ${i} missing required data, skipping`);
        }
      } catch (error) {
        console.error(`[Scraper] Error parsing row ${i}:`, error);
      }
    }

    console.log(`[Scraper] Successfully scraped ${biddings.length} items`);

    return {
      success: true,
      itemsScraped: biddings.length,
      newItems: biddings.length,
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
 * 参加申請期間から入札日を抽出
 * 例: "R8/1/16 8:30 ～R8/1/29 12:00" → 終了日をDate型に変換
 */
function parseApplicationPeriod(periodStr: string): Date | undefined {
  try {
    if (!periodStr) return undefined;

    // 終了日を抽出（～の後）
    const match = periodStr.match(/～\s*R(\d+)\/(\d+)\/(\d+)/);
    if (match) {
      const reiwaYear = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      
      // 令和→西暦変換（令和元年=2019年）
      const year = reiwaYear + 2018;
      
      return new Date(year, month - 1, day);
    }

    return undefined;
  } catch (error) {
    console.error("[Scraper] Error parsing application period:", periodStr, error);
    return undefined;
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
