import { chromium, Browser, Page } from "playwright";
import { generateTenderCanonicalId } from "./tenderIdentity.js";
import fs from "node:fs";
import { execSync } from "node:child_process";

/**
 * 検索条件インターフェース
 */
export interface SearchConditions {
  /** 発注区分（電子入札/紙入札/全て） */
  orderType?: string;
  /** 入札方式 */
  biddingMethod?: string;
  /** 区分（工事/委託） */
  projectType?: string[];
  /** 種別コード（カンマ区切り） */
  categoryCodes?: string;
  /** 格付（A/B/C/D/指定なし） */
  rating?: string[];
  /** 発注機関コード */
  organizationCode?: string;
  /** 履行場所 */
  location?: string;
  /** 公告日（From） */
  publicationDateFrom?: Date;
  /** 公告日（To） */
  publicationDateTo?: Date;
  /** 予定価格（最小） */
  estimatedPriceMin?: number;
  /** 予定価格（最大） */
  estimatedPriceMax?: number;
  /** 件名キーワード */
  titleKeyword?: string;
  /** 施工番号 */
  constructionNo?: string;
  /** 最新公告情報を取得（true の場合、他の条件を無視） */
  useLatestAnnouncement?: boolean;
}

/**
 * スクレイピング結果の個別アイテム
 */
export interface ScrapedBiddingItem {
  no: string;
  caseNumber: string;
  orderOrganName: string;
  hasQuestion: string;
  title: string;
  biddingMethod: string;
  constructionType: string;
  rating: string;
  applicationPeriod: string;
  status: string;
  detailUrl?: string;
  // 詳細情報（詳細ページから取得）
  estimatedPrice?: number;
  location?: string;
  constructionPeriod?: string;
  publicationDate?: Date;
  biddingDate?: Date;
  applicationDeadline?: Date;
  remarks?: string;
}

/**
 * スクレイピング結果
 */
export interface ScraperResult {
  success: boolean;
  items: ScrapedBiddingItem[];
  totalCount: number;
  errorMessage?: string;
}

/**
 * 三重県入札情報サイトのスクレイパー（Puppeteer版）
 */
export class MieBiddingScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private readonly baseUrl = "https://mie.efftis.jp/24000/ppi/pub";
  private readonly topPageUrl = "https://www.pref.mie.lg.jp/ebid-mie/83336046773.htm";
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5秒

  /**
   * Playwrightブラウザを初期化
   */
  private async initBrowser(): Promise<void> {
    console.log("[Scraper] Initializing Playwright browser");
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    
    console.log("[Scraper] Playwright browser initialized");
  }

  /**
   * TOPページから入札情報ページへ遷移
   */
  private async navigateFromTopPage(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("[Scraper] Navigating from TOP page");
    await this.page.goto(this.topPageUrl, { waitUntil: "networkidle" });
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // 「入札情報（工事・委託）」ボタンを探す
      const buttonSelector = 'a:has-text("入札情報")';
      await this.page.waitForSelector(buttonSelector, { timeout: 10000 });
      
      // 新しいページが開くのを待機
      const [newPage] = await Promise.all([
        this.page.context().waitForEvent("page"),
        this.page.click(buttonSelector),
      ]);

      // 新しいページに切り替え
      this.page = newPage;
      await this.page.waitForSelector("#searchBtn", { timeout: 15000 });
      console.log("[Scraper] Successfully navigated to bidding page");
    } catch (error) {
      console.warn("[Scraper] Failed to navigate from TOP page, accessing directly");
      await this.page.goto(this.baseUrl, { waitUntil: "networkidle" });
      await this.page.waitForSelector("#searchBtn", { timeout: 15000 });
    }
  }

  /**
   * 検索条件を設定
   */
  private async setSearchConditions(conditions: SearchConditions): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("[Scraper] Setting search conditions:", JSON.stringify(conditions, null, 2));

    // 区分（工事/委託）
    if (conditions.projectType && conditions.projectType.length > 0) {
      if (conditions.projectType.includes("工事")) {
        const checkbox = await this.page.$('input[name="ankenKbn1"]');
        if (checkbox) {
          const isChecked = await this.page.evaluate((el) => (el as HTMLInputElement).checked, checkbox);
          if (!isChecked) {
            await checkbox.click();
          }
        }
      }
      if (conditions.projectType.includes("委託")) {
        const checkbox = await this.page.$('input[name="ankenKbn2"]');
        if (checkbox) {
          const isChecked = await this.page.evaluate((el) => (el as HTMLInputElement).checked, checkbox);
          if (!isChecked) {
            await checkbox.click();
          }
        }
      }
    }

    // 件名キーワード
    if (conditions.titleKeyword) {
      await this.page.type('input[name="subjectName"]', conditions.titleKeyword);
    }

    // 履行場所
    if (conditions.location) {
      await this.page.type('input[name="performLocation"]', conditions.location);
    }

    // 施工番号
    if (conditions.constructionNo) {
      await this.page.type('input[name="constructionNo"]', conditions.constructionNo);
    }

    // 予定価格
    if (conditions.estimatedPriceMin) {
      await this.page.type('input[name="estimatePriceFrom"]', conditions.estimatedPriceMin.toString());
    }
    if (conditions.estimatedPriceMax) {
      await this.page.type('input[name="estimatePriceTo"]', conditions.estimatedPriceMax.toString());
    }

    console.log("[Scraper] Search conditions set successfully");
  }

  /**
   * 検索を実行
   */
  private async executeSearch(useLatest: boolean = true): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    if (useLatest) {
      // 最新公告情報ボタンを実行
      console.log("[Scraper] Executing latest announcement search");
      await this.page.evaluate(() => {
        (window as any).LinkSubmit('P004', '4', 'searchBtn');
      });
    } else {
      // 通常の検索実行
      console.log("[Scraper] Executing normal search");
      await this.page.evaluate(() => {
        (window as any).LinkSubmit('P004', '2', 'searchBtn');
      });
    }

    // ページ遷移を待機
    await new Promise(resolve => setTimeout(resolve, 8000));
    console.log("[Scraper] Search executed");
  }

  /**
   * 結果テーブルを特定
   */
  private async findResultTable(): Promise<boolean> {
    if (!this.page) throw new Error("Page not initialized");

    const tables = await this.page.$$("table");
    console.log(`[Scraper] Found ${tables.length} tables`);

    for (const table of tables) {
      try {
        const firstRowText = await table.$eval("tr", (row) => row.textContent || "");
        
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
  private async extractDataFromTable(): Promise<ScrapedBiddingItem[]> {
    if (!this.page) throw new Error("Page not initialized");

    const items: ScrapedBiddingItem[] = [];

    const rows = await this.page.$$("table tr");
    console.log(`[Scraper] Found ${rows.length} rows in result table`);

    for (let i = 1; i < rows.length; i++) {
      try {
        const cells = await rows[i].$$("td");
        if (cells.length < 9) {
          console.log(`[Scraper] Row ${i} has only ${cells.length} cells, skipping`);
          continue;
        }

        const cellTexts = await Promise.all(
          cells.map((cell) => cell.evaluate((el) => el.textContent?.trim() || ""))
        );

        // 発注機関と施行番号を分割
        const organAndNumber = cellTexts[1].trim();
        const match = organAndNumber.match(/(\d{8})$/);
        const caseNumber = match ? match[1] : "";
        const orderOrganName = match 
          ? organAndNumber.substring(0, organAndNumber.length - 8).trim()
          : organAndNumber;

        console.log(`[Scraper] Row ${i}: No=${cellTexts[0].trim()}, Organ=${orderOrganName}, CaseNo=${caseNumber}`);

        // 詳細ページURLを取得
        let detailUrl = "";
        try {
          const link = await cells[3].$("a");
          if (link) {
            detailUrl = await link.evaluate((el) => (el as HTMLAnchorElement).href);
          }
        } catch (error) {
          // リンクがない場合はスキップ
        }

        items.push({
          no: cellTexts[0].trim(),
          caseNumber,
          orderOrganName,
          hasQuestion: cellTexts[2].trim(),
          title: cellTexts[3].trim(),
          biddingMethod: cellTexts[4].trim(),
          constructionType: cellTexts[5].trim(),
          rating: cellTexts[6].trim(),
          applicationPeriod: cellTexts[7].trim(),
          status: cellTexts[8].trim(),
          detailUrl: detailUrl || undefined,
        });
      } catch (error) {
        console.error(`[Scraper] Error extracting row ${i}:`, error);
        continue;
      }
    }

    return items;
  }

  /**
   * 次ページが存在するかチェック
   */
  private async hasNextPage(): Promise<boolean> {
    if (!this.page) return false;

    try {
      const nextPageLinks = await this.page.$$('a:has-text("次ページ")');
      return nextPageLinks.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 次ページへ遷移
   */
  private async goToNextPage(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("[Scraper] Navigating to next page");
    await this.page.click('a:has-text("次ページ")');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log("[Scraper] Navigated to next page");
  }

  /**
   * 詳細ページから追加情報を取得
   */
  private async fetchDetailInfo(item: ScrapedBiddingItem): Promise<void> {
    if (!this.page || !item.detailUrl) return;

    try {
      console.log(`[Scraper] Fetching detail info for: ${item.title}`);
      
      // 新しいページで詳細を開く
      const detailPage = await this.browser!.newPage();
      await detailPage.goto(item.detailUrl, { waitUntil: "networkidle" });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 詳細情報を抽出（実装は省略、必要に応じて追加）
      // item.estimatedPrice = ...
      // item.location = ...
      // item.constructionPeriod = ...
      // item.publicationDate = ...
      // item.biddingDate = ...
      // item.applicationDeadline = ...
      // item.remarks = ...

      await detailPage.close();
      console.log(`[Scraper] Detail info fetched for: ${item.title}`);
    } catch (error) {
      console.error(`[Scraper] Error fetching detail info for ${item.title}:`, error);
    }
  }

  /**
   * スクレイピングを実行
   */
  async scrape(conditions: SearchConditions = {}): Promise<ScraperResult> {
    let retryCount = 0;
    
    while (retryCount < this.maxRetries) {
      try {
        console.log(`[Scraper] Starting scrape attempt ${retryCount + 1}/${this.maxRetries}`);
        
        // ブラウザ初期化
        await this.initBrowser();
        
        // TOPページから遷移
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
          throw new Error("Result table not found");
        }
        
        // データ抽出
        let allItems: ScrapedBiddingItem[] = [];
        let pageCount = 0;
        
        do {
          pageCount++;
          console.log(`[Scraper] Extracting data from page ${pageCount}`);
          
          const pageItems = await this.extractDataFromTable();
          allItems = allItems.concat(pageItems);
          
          console.log(`[Scraper] Extracted ${pageItems.length} items from page ${pageCount}`);
          
          // 次ページがあれば遷移
          if (await this.hasNextPage()) {
            await this.goToNextPage();
          } else {
            break;
          }
        } while (pageCount < 20); // 最大20ページまで（171件すべてを取得するため）
        
        console.log(`[Scraper] Successfully scraped ${allItems.length} items from ${pageCount} pages`);
        
        // ブラウザを閉じる
        await this.cleanup();
        
        return {
          success: true,
          items: allItems,
          totalCount: allItems.length,
        };
        
      } catch (error) {
        console.error(`[Scraper] Error during scrape attempt ${retryCount + 1}:`, error);
        
        // クリーンアップ
        await this.cleanup();
        
        retryCount++;
        
        if (retryCount < this.maxRetries) {
          console.log(`[Scraper] Retrying in ${this.retryDelay / 1000} seconds...`);
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        } else {
          return {
            success: false,
            items: [],
            totalCount: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }
    
    return {
      success: false,
      items: [],
      totalCount: 0,
      errorMessage: "Max retries exceeded",
    };
  }

  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        console.log("[Scraper] Browser closed");
      }
    } catch (error) {
      console.error("[Scraper] Error during cleanup:", error);
    }
  }
}

/**
 * スクレイピングを実行する便利関数
 */
export async function scrapeMieBidding(
  conditions: SearchConditions = {}
): Promise<ScraperResult> {
  const scraper = new MieBiddingScraper();
  try {
    return await scraper.scrape(conditions);
  } finally {
    await scraper.cleanup();
  }
}

/**
 * ScrapedBiddingItemをデータベース挿入用に変換
 */
export function convertToInsertBidding(item: ScrapedBiddingItem): any {
  const bidding: any = {
    caseNumber: item.caseNumber,
    title: item.title,
    orderOrganName: item.orderOrganName,
    biddingMethod: item.biddingMethod,
    constructionType: item.constructionType,
    rating: item.rating,
    applicationPeriod: item.applicationPeriod,
    status: item.status,
    hasQuestion: item.hasQuestion,
    detailUrl: item.detailUrl,
    estimatedPrice: item.estimatedPrice ? item.estimatedPrice.toString() : null,
    location: item.location,
    constructionPeriod: item.constructionPeriod,
    publicationDate: item.publicationDate,
    biddingDate: item.biddingDate,
    applicationDeadline: item.applicationDeadline,
    remarks: item.remarks,
    rawData: JSON.stringify(item),
  };
  
  // tenderCanonicalIdを生成
  bidding.tenderCanonicalId = generateTenderCanonicalId(bidding);
  
  return bidding;
}

/**
 * scrapeMieBiddingsのエイリアス（後方互換性のため）
 */
export async function scrapeMieBiddings(
  conditions: SearchConditions = {},
  fetchDetails: boolean = false
): Promise<ScraperResult> {
  // fetchDetailsパラメータは現在未実装（将来的に追加予定）
  return scrapeMieBidding(conditions);
}
