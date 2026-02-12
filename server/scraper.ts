import { Builder, By, until, WebDriver, WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

/**
 * 検索条件
 */
export interface SearchConditions {
  /** 発注区分 */
  orderType?: string;
  /** 入札方式 */
  biddingMethod?: string;
  /** 区分（工事/委託） */
  category?: "工事" | "委託";
  /** 種別 */
  types?: string[];
  /** 格付 */
  ratings?: string[];
  /** 本庁/地域機関/その他 */
  agencies?: string[];
  /** 部局 */
  departments?: string[];
  /** 所属 */
  affiliations?: string[];
  /** 履行場所 */
  location?: string;
  /** 公開日（From） */
  publicDateFrom?: Date;
  /** 公開日（To） */
  publicDateTo?: Date;
  /** 更新日（From） */
  updateDateFrom?: Date;
  /** 更新日（To） */
  updateDateTo?: Date;
  /** 予定価格（From） */
  budgetFrom?: number;
  /** 予定価格（To） */
  budgetTo?: number;
  /** 件名文字列 */
  title?: string;
  /** 施工番号 */
  constructionNo?: string;
  /** 最新公告情報を取得（true の場合、他の条件を無視） */
  useLatestAnnouncement?: boolean;
  /** 工事種別 */
  projectType?: string[];
  /** 件名キーワード */
  titleKeyword?: string;
  /** 予定価格（最小） */
  estimatedPriceMin?: number;
  /** 予定価格（最大） */
  estimatedPriceMax?: number;
  /** 格付（単一値） */
  rating?: string[];
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
   * Seleniumブラウザを初期化
   */
  private async initBrowser(): Promise<void> {
    console.log("[Scraper] Initializing Selenium WebDriver");
    
    const options = new chrome.Options();
    options.addArguments("--headless");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");

    this.driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
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
  private async navigateFromTopPage(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log(`[Scraper] Navigating to top page: ${this.topPageUrl}`);
    await this.driver.get(this.topPageUrl);

    // 「入札情報サービスシステム（公共調達）」リンクをクリック
    console.log("[Scraper] Looking for public procurement link");
    
    await this.driver.wait(until.elementLocated(By.linkText("入札情報サービスシステム（公共調達）")), 10000);
    const link = await this.driver.findElement(By.linkText("入札情報サービスシステム（公共調達）"));
    await link.click();

    // ウィンドウハンドルを切り替え
    const handles = await this.driver.getAllWindowHandles();
    if (handles.length > 1) {
      await this.driver.switchTo().window(handles[1]);
    }

    // ページが読み込まれるまで待機
    await this.driver.wait(until.elementLocated(By.css("table")), 10000);
    console.log("[Scraper] Navigated to search page");
  }

  /**
   * 検索条件を設定
   */
  private async setSearchConditions(conditions: SearchConditions): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log("[Scraper] Setting search conditions");

    // 各条件を設定（実装は省略、必要に応じて追加）
    if (conditions.title) {
      const titleInput = await this.driver.findElement(By.name("titleSearch"));
      await titleInput.sendKeys(conditions.title);
    }

    console.log("[Scraper] Search conditions set");
  }

  /**
   * 検索を実行
   */
  private async executeSearch(useLatest: boolean = true): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    if (useLatest) {
      // 最新公告情報ボタンを実行
      console.log("[Scraper] Executing latest announcement search");
      await this.driver.executeScript("LinkSubmit('P004', '4', 'searchBtn');");
    } else {
      // 通常の検索実行
      console.log("[Scraper] Executing normal search");
      await this.driver.executeScript("LinkSubmit('P004', '2', 'searchBtn');");
    }

    // ページ遷移を待機
    await this.driver.sleep(10000);
    console.log("[Scraper] Search executed and page loaded");
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
   * ページネーションを処理
   */
  private async handlePagination(maxPages: number = 20): Promise<BiddingInfo[]> {
    if (!this.driver) throw new Error("Driver not initialized");

    const allItems: BiddingInfo[] = [];
    let currentPage = 1;

    while (currentPage <= maxPages) {
      console.log(`[Scraper] Processing page ${currentPage}`);

      const items = await this.extractTableData();
      allItems.push(...items);

      // 次ページボタンを探す
      try {
        const nextButton = await this.driver.findElement(By.linkText("次へ"));
        const isEnabled = await nextButton.isEnabled();

        if (!isEnabled) {
          console.log("[Scraper] No more pages");
          break;
        }

        await nextButton.click();
        await this.driver.sleep(3000);
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
   */
  async scrape(conditions: SearchConditions, fetchDetails: boolean = false): Promise<ScrapingResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[Scraper] Attempt ${attempt}/${this.maxRetries}`);
        
        await this.initBrowser();
        await this.navigateFromTopPage();
        
        // 検索条件を設定
        if (!conditions.useLatestAnnouncement) {
          await this.setSearchConditions(conditions);
        }
        
        // 検索実行
        await this.executeSearch(conditions.useLatestAnnouncement ?? true);
        
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
        const items = await this.handlePagination(20);

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
 */
export async function scrapeMieBiddings(
  conditions: SearchConditions,
  fetchDetails: boolean = false
): Promise<ScrapingResult> {
  const scraper = new MieBiddingScraper();
  return await scraper.scrape(conditions, fetchDetails);
}

/**
 * tenderCanonicalIdを生成
 */
function generateTenderCanonicalId(bidding: any): string {
  const parts = [
    bidding.caseNumber || "",
    bidding.title || "",
    bidding.orderOrganName || "",
  ];
  return parts.filter(Boolean).join("_");
}

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
  
  // tenderCanonicalIdを生成
  bidding.tenderCanonicalId = generateTenderCanonicalId(bidding);
  
  return bidding;
}
