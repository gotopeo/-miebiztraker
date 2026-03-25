import { Builder, By, until, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import chromium from "@sparticuz/chromium";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { generateTenderCanonicalId as generateCanonicalId } from "./tenderIdentity.js";

const execAsync = promisify(exec);

/**
 * 検索条件（最新公告情報のみ）
 */
export interface SearchConditions {
  /** 最新公告情報を取得（常にtrue） */
  useLatestAnnouncement: boolean;
}

/**
 * 入札情報
 */
export interface BiddingInfo {
  no: string;
  agency: string;
  constructionNo: string;
  hasQuestion: string;
  title: string;
  biddingMethod: string;
  type: string;
  rating: string;
  applicationPeriod: string;
  receptionStatus: string;
  detailUrl?: string;
}

/**
 * スクレイピング結果
 */
export interface ScrapingResult {
  success: boolean;
  items: BiddingInfo[];
  totalCount: number;
  errorMessage?: string;
}

/**
 * 三重県入札情報サイトのスクレイパー（Selenium版）
 */
export class MieBiddingScraper {
  private driver: WebDriver | null = null;
  private readonly baseUrl = "https://mie.efftis.jp/24000/ppi/pub";
  private readonly topPageUrl = "https://www.pref.mie.lg.jp/ebid-mie/83336046773.htm";
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5秒

  /**
   * Selenium Managerを使用してChromeDriverのパスを取得
   */
  private async getChromeDriverPath(chromiumPath: string): Promise<string> {
    const seleniumManagerPath = path.join(
      process.cwd(),
      'node_modules',
      'selenium-webdriver',
      'bin',
      'linux',
      'selenium-manager'
    );

    const command = `${seleniumManagerPath} --browser chrome --browser-path ${chromiumPath} --skip-driver-in-path --output JSON`;

    try {
      console.log('[Scraper] Running Selenium Manager to get ChromeDriver...');
      const { stdout } = await execAsync(command);
      const result = JSON.parse(stdout);
      
      if (result.result.code === 0) {
        console.log(`[Scraper] ChromeDriver path: ${result.result.driver_path}`);
        return result.result.driver_path;
      } else {
        throw new Error(`Selenium Manager failed: ${result.result.message}`);
      }
    } catch (error) {
      console.error('[Scraper] Failed to get ChromeDriver path:', error);
      throw error;
    }
  }

  /**
   * Seleniumブラウザを初期化
   */
  private async initBrowser(): Promise<void> {
    console.log("[Scraper] Initializing Selenium WebDriver");
    
    const options = new chrome.Options();
    
    // @sparticuz/chromiumのパスを設定
    const chromiumPath = await chromium.executablePath();
    console.log(`[Scraper] Using Chromium at: ${chromiumPath}`);
    options.setChromeBinaryPath(chromiumPath);
    
    // Chromiumの推奨引数を追加
    const chromiumArgs = chromium.args;
    chromiumArgs.forEach(arg => options.addArguments(arg));
    
    // 追加の引数
    options.addArguments("--headless=new");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");

    // Selenium Managerを使用してChromeDriverのパスを取得
    const chromedriverPath = await this.getChromeDriverPath(chromiumPath);
    const service = new chrome.ServiceBuilder(chromedriverPath);

    this.driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .setChromeService(service)
      .build();

    console.log("[Scraper] Selenium WebDriver initialized");
  }

  /**
   * ブラウザを閉じる
   */
  private async closeBrowser(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      console.log("[Scraper] Browser closed");
    }
  }

  /**
   * トップページから検索ページに遷移
   */
  private async navigateToSearchPage(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log(`[Scraper] Navigating to top page: ${this.topPageUrl}`);
    await this.driver.get(this.topPageUrl);

    // 「入札情報（工事・委託）」画像リンクをクリック
    console.log("[Scraper] Looking for bidding information link");
    
    // 正しい入札情報ページのリンクを探す（/ppi/pubを含む）
    await this.driver.wait(until.elementLocated(By.css('a[href*="/ppi/pub"]')), 15000);
    const linkElement = await this.driver.findElement(By.css('a[href*="/ppi/pub"]'));
    
    // 要素が表示されるまで待機
    await this.driver.wait(until.elementIsVisible(linkElement), 15000);
    
    // JavaScriptで強制的にクリック
    await this.driver.executeScript("arguments[0].click();", linkElement);
    console.log("[Scraper] Clicked bidding information link");

    // ウィンドウハンドルを切り替え（新ウィンドウが開くまで動的に待機）
    await this.driver.wait(async () => {
      const handles = await this.driver!.getAllWindowHandles();
      return handles.length > 1;
    }, 10000, "新しいウィンドウが開くのを待機中");
    const handles = await this.driver.getAllWindowHandles();
    if (handles.length > 1) {
      await this.driver.switchTo().window(handles[1]);
      console.log("[Scraper] Switched to new window");
    }

    // ページが読み込まれるまで待機
    await this.driver.wait(until.elementLocated(By.css("table")), 15000);
    console.log("[Scraper] Successfully navigated to search page");
  }



  /**
   * 最新公告情報を検索実行
   */
  private async executeSearch(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log("[Scraper] Executing latest announcement search");
    
    try {
      // 「最新公告情報」リンクを探す
      const latestLink = await this.driver.wait(
        until.elementLocated(By.linkText("最新公告情報")),
        10000
      );
      
      console.log("[Scraper] Found latest announcement link");
      
      // リンクが表示されるまで待機
      await this.driver.wait(until.elementIsVisible(latestLink), 5000);
      
      // リンクをクリック
      await latestLink.click();
      console.log("[Scraper] Clicked latest announcement link");
      
      // ページ遷移を動的に待機（テーブルが現れるまで待つ、最大15秒）
      await this.driver.wait(
        until.elementLocated(By.css("table tr")),
        15000,
        "検索結果テーブルの読み込みを待機中"
      );
      console.log("[Scraper] Search executed and page loaded");
    } catch (error) {
      console.error("[Scraper] Failed to click latest announcement link:", error);
      throw error;
    }
  }

  /**
   * 結果テーブルを特定
   */
  private async findResultTable(): Promise<boolean> {
    if (!this.driver) throw new Error("Driver not initialized");

    const tables = await this.driver.findElements(By.css("table"));
    console.log(`[Scraper] Found ${tables.length} tables`);

    for (const table of tables) {
      try {
        const firstRow = await table.findElement(By.css("tr"));
        const firstRowText = await firstRow.getText();
        
        if (firstRowText.includes("案件名称") && firstRowText.includes("発注機関")) {
          console.log(`[Scraper] Found result table with header: ${firstRowText.substring(0, 50)}`);
          return true;
        }
      } catch (error) {
        continue;
      }
    }

    return false;
  }

  /**
   * テーブルからデータを抽出
   */
  private async extractTableData(): Promise<BiddingInfo[]> {
    if (!this.driver) throw new Error("Driver not initialized");

    const items: BiddingInfo[] = [];
    const tables = await this.driver.findElements(By.css("table"));

    for (const table of tables) {
      try {
        const firstRow = await table.findElement(By.css("tr"));
        const firstRowText = await firstRow.getText();
        
        if (!firstRowText.includes("案件名称") || !firstRowText.includes("発注機関")) {
          continue;
        }

        const rows = await table.findElements(By.css("tr"));
        console.log(`[Scraper] Found ${rows.length} rows in result table`);

        for (let i = 1; i < rows.length; i++) {
          try {
            const row = rows[i];
            const cells = await row.findElements(By.css("td"));

            if (cells.length < 9) continue;

            const item: BiddingInfo = {
              no: await cells[0].getText(),
              agency: await cells[1].getText(),
              constructionNo: "",
              hasQuestion: await cells[2].getText(),
              title: await cells[3].getText(),
              biddingMethod: await cells[4].getText(),
              type: await cells[5].getText(),
              rating: await cells[6].getText(),
              applicationPeriod: await cells[7].getText(),
              receptionStatus: await cells[8].getText(),
            };

            // 発注機関と施工番号を分離
            const agencyParts = item.agency.split("\n");
            if (agencyParts.length >= 2) {
              item.agency = agencyParts[0].trim();
              item.constructionNo = agencyParts[1].trim();
            }

            // 詳細URLを取得
            try {
              const link = await cells[3].findElement(By.css("a"));
              item.detailUrl = await link.getAttribute("href");
            } catch (error) {
              // リンクがない場合はスキップ
            }

            items.push(item);
          } catch (error) {
            console.error(`[Scraper] Error extracting row ${i}:`, error);
            continue;
          }
        }

        break;
      } catch (error) {
        continue;
      }
    }

    console.log(`[Scraper] Extracted ${items.length} items from table`);
    return items;
  }

  /**
   * ページネーションを処理（差分取得対応）
   * existingCanonicalIds: DBに既に存在するtenderCanonicalIdのセット
   *   - 指定した場合、既存案件が連続して出現したらスクレイピングを停止する（差分取得モード）
   *   - 指定しない場合、全ページを取得する（フルスキャンモード）
   */
  private async handlePagination(
    maxPages: number = 40,
    existingCanonicalIds?: Set<string>
  ): Promise<BiddingInfo[]> {
    if (!this.driver) throw new Error("Driver not initialized");

    const allItems: BiddingInfo[] = [];
    let currentPage = 1;
    // 差分取得モード: 既存案件が何件連続したら停止するか
    const CONSECUTIVE_EXISTING_THRESHOLD = 5;

    while (currentPage <= maxPages) {
      console.log(`[Scraper] Processing page ${currentPage}`);

      const items = await this.extractTableData();

      if (existingCanonicalIds) {
        // 差分取得モード: 既存案件が連続して出現したら停止
        let consecutiveExisting = 0;
        for (const item of items) {
          const canonicalId = generateCanonicalId({
            caseNumber: String(item.constructionNo || ""),
            orderOrganName: item.agency,
            title: item.title,
            detailUrl: item.detailUrl,
          });
          if (existingCanonicalIds.has(canonicalId)) {
            consecutiveExisting++;
            if (consecutiveExisting >= CONSECUTIVE_EXISTING_THRESHOLD) {
              console.log(`[Scraper] ${CONSECUTIVE_EXISTING_THRESHOLD}件連続で既存案件を検出 → 差分取得完了（page ${currentPage}）`);
              allItems.push(...items.slice(0, items.indexOf(item) - CONSECUTIVE_EXISTING_THRESHOLD + 1));
              return allItems;
            }
          } else {
            consecutiveExisting = 0; // 新着案件が出たらリセット
            allItems.push(item);
          }
        }
        // このページは全て新着 or 既存が閾値未満 → 全件追加
        if (consecutiveExisting < CONSECUTIVE_EXISTING_THRESHOLD) {
          // items全体をallItemsに追加（上のループで追加済みのものは除く）
          const alreadyAdded = allItems.slice(allItems.length - items.length);
          if (alreadyAdded.length < items.length) {
            // まだ追加されていない分を追加
            allItems.push(...items.slice(alreadyAdded.length));
          }
        }
      } else {
        // フルスキャンモード: 全件追加
        allItems.push(...items);
      }

      // 次ページボタンを探す
      try {
        const nextButton = await this.driver.findElement(By.linkText("次ページ"));
        const isEnabled = await nextButton.isEnabled();

        if (!isEnabled) {
          console.log("[Scraper] No more pages");
          break;
        }

        // 現在のテーブルを記録して、次ページ読み込み後に古いテーブルが消えたことを確認
        const currentTable = await this.driver.findElement(By.css("table"));
        await nextButton.click();

        // 古いテーブルが消えるまで待機（動的待機）
        try {
          await this.driver.wait(until.stalenessOf(currentTable), 8000);
        } catch {
          // stalenessOfが失敗した場合は短いsleepにフォールバック
          await this.driver.sleep(1000);
        }
        // 新しいテーブルが現れるまで待機
        await this.driver.wait(
          until.elementLocated(By.css("table tr")),
          10000,
          "次ページのテーブル読み込みを待機中"
        );

        currentPage++;
      } catch (error) {
        console.log("[Scraper] No next page button found");
        break;
      }
    }

    return allItems;
  }

  /**
   * スクレイピングを実行（リトライ機能付き）
   * existingCanonicalIds: 差分取得モード用に、DBに既存するtenderCanonicalIdのセットを渡す
   */
  async scrape(conditions: SearchConditions, fetchDetails: boolean = false, existingCanonicalIds?: Set<string>): Promise<ScrapingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[Scraper] Attempt ${attempt}/${this.maxRetries}`);
        
        await this.initBrowser();
        await this.navigateToSearchPage();
        
        // 最新公告情報を検索実行
        await this.executeSearch();
        
        // 結果テーブルを探す
        const hasTable = await this.findResultTable();
        
        if (!hasTable) {
          console.log("[Scraper] No result table found");
          return {
            success: true,
            items: [],
            totalCount: 0,
          };
        }

        // ページネーションを処理してデータを取得
        // existingCanonicalIdsが渡された場合は差分取得モード（新着のみ取得）
        const items = await this.handlePagination(30, existingCanonicalIds);

        await this.closeBrowser();

        return {
          success: true,
          items,
          totalCount: items.length,
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`[Scraper] Attempt ${attempt} failed:`, error);
        
        await this.closeBrowser();
        
        if (attempt < this.maxRetries) {
          console.log(`[Scraper] Retrying in ${this.retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    return {
      success: false,
      items: [],
      totalCount: 0,
      errorMessage: lastError?.message || "Unknown error",
    };
  }
}

/**
 * スクレイピングを実行する関数
 * existingCanonicalIds: 差分取得モード用に、DBに既存するtenderCanonicalIdのセットを渡す
 *   - 指定した場合、既存案件が5件連続したらスクレイピングを停止（新着のみ取得）
 *   - 指定しない場合、全ページを取得（フルスキャン）
 */
export async function scrapeMieBiddings(
  conditions: SearchConditions,
  fetchDetails: boolean = false,
  existingCanonicalIds?: Set<string>
): Promise<ScrapingResult> {
  const scraper = new MieBiddingScraper();
  
  // 10分のタイムアウトを設定
  const timeout = 10 * 60 * 1000; // 10分
  const timeoutPromise = new Promise<ScrapingResult>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Scraping timeout: Process exceeded 10 minutes'));
    }, timeout);
  });
  
  try {
    return await Promise.race([
      scraper.scrape(conditions, fetchDetails, existingCanonicalIds),
      timeoutPromise
    ]);
  } catch (error) {
    // タイムアウトまたはエラーの場合、ブラウザをクローズ
    await scraper['closeBrowser']();
    throw error;
  }
}

// generateTenderCanonicalIdはtenderIdentity.tsの関数を使用（定義を削除して共通化）

/**
 * BiddingInfoをデータベース挿入用の形式に変換
 */
export function convertToInsertBidding(item: BiddingInfo): any {
  const bidding: any = {
    caseNumber: item.constructionNo,
    title: item.title,
    orderOrganName: item.agency,
    biddingMethod: item.biddingMethod,
    constructionType: item.type,
    rating: item.rating,
    applicationPeriod: item.applicationPeriod,
    status: item.receptionStatus,
    hasQuestion: item.hasQuestion,
    detailUrl: item.detailUrl,
    estimatedPrice: null,
    location: null,
    constructionPeriod: null,
    publicationDate: null,
    biddingDate: null,
    applicationDeadline: null,
    remarks: null,
    rawData: JSON.stringify(item),
  };
  
  // tenderCanonicalIdを生成（tenderIdentity.tsの共通関数を使用）
  // caseNumberが数値の場合に備えてString()で明示変換
  bidding.tenderCanonicalId = generateCanonicalId({
    caseNumber: String(bidding.caseNumber || ""),
    orderOrganCode: bidding.orderOrganCode ? String(bidding.orderOrganCode) : undefined,
    orderOrganName: bidding.orderOrganName,
    title: bidding.title,
    detailUrl: bidding.detailUrl,
  });
  
  return bidding;
}
