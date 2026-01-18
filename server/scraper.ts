import { Builder, By, until, WebDriver, WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

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
 * 三重県入札情報サイトのスクレイパー
 */
export class MieBiddingScraper {
  private driver: WebDriver | null = null;
  private readonly baseUrl = "https://mie.efftis.jp/24000/ppi/pub";
  private readonly topPageUrl = "https://www.pref.mie.lg.jp/ebid-mie/83336046773.htm";
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000; // 5秒

  /**
   * WebDriverを初期化
   */
  private async initDriver(): Promise<void> {
    const options = new chrome.Options();
    options.addArguments("--headless");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--disable-gpu");
    options.addArguments("--window-size=1920,1080");

    // ChromeDriver 128を使用
    const service = new chrome.ServiceBuilder("/usr/local/bin/chromedriver-128");

    this.driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .setChromeService(service)
      .build();

    console.log("[Scraper] WebDriver initialized");
  }

  /**
   * TOPページから入札情報ページへ遷移
   */
  private async navigateFromTopPage(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log("[Scraper] Navigating from TOP page");
    await this.driver.get(this.topPageUrl);
    await this.driver.sleep(2000);

    try {
      // 「入札情報（工事・委託）」ボタンを探す
      const button = await this.driver.findElement(
        By.xpath("//a[contains(text(), '入札情報') and contains(text(), '工事')]")
      );
      await button.click();
      console.log("[Scraper] Clicked bidding information button");

      // 新しいウィンドウに切り替え
      await this.driver.sleep(2000);
      const handles = await this.driver.getAllWindowHandles();
      if (handles.length > 1) {
        await this.driver.switchTo().window(handles[1]);
        console.log("[Scraper] Switched to new window");
      }

      await this.driver.wait(until.elementLocated(By.id("searchBtn")), 15000);
      console.log("[Scraper] Successfully navigated to bidding page");
    } catch (error) {
      console.warn("[Scraper] Failed to navigate from TOP page, accessing directly");
      await this.driver.get(this.baseUrl);
      await this.driver.wait(until.elementLocated(By.id("searchBtn")), 15000);
    }
  }

  /**
   * 検索条件を設定
   */
  private async setSearchConditions(conditions: SearchConditions): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log("[Scraper] Setting search conditions:", JSON.stringify(conditions, null, 2));

    // 区分（工事/委託）
    if (conditions.projectType && conditions.projectType.length > 0) {
      if (conditions.projectType.includes("工事")) {
        const checkbox = await this.driver.findElement(By.name("ankenKbn1"));
        if (!(await checkbox.isSelected())) {
          await checkbox.click();
        }
      }
      if (conditions.projectType.includes("委託")) {
        const checkbox = await this.driver.findElement(By.name("ankenKbn2"));
        if (!(await checkbox.isSelected())) {
          await checkbox.click();
        }
      }
    }

    // 件名キーワード
    if (conditions.titleKeyword) {
      const input = await this.driver.findElement(By.name("subjectName"));
      await input.clear();
      await input.sendKeys(conditions.titleKeyword);
    }

    // 履行場所
    if (conditions.location) {
      const input = await this.driver.findElement(By.name("performLocation"));
      await input.clear();
      await input.sendKeys(conditions.location);
    }

    // 施工番号
    if (conditions.constructionNo) {
      const input = await this.driver.findElement(By.name("constructionNo"));
      await input.clear();
      await input.sendKeys(conditions.constructionNo);
    }

    // 予定価格
    if (conditions.estimatedPriceMin) {
      const input = await this.driver.findElement(By.name("estimatePriceFrom"));
      await input.clear();
      await input.sendKeys(conditions.estimatedPriceMin.toString());
    }
    if (conditions.estimatedPriceMax) {
      const input = await this.driver.findElement(By.name("estimatePriceTo"));
      await input.clear();
      await input.sendKeys(conditions.estimatedPriceMax.toString());
    }

    console.log("[Scraper] Search conditions set successfully");
  }

  /**
   * 検索を実行
   */
  private async executeSearch(useLatest: boolean = true): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    if (useLatest) {
      // 最新公告情報ボタンを実行
      console.log("[Scraper] Executing latest announcement search");
      await this.driver.executeScript("LinkSubmit('P004','4','searchBtn');");
    } else {
      // 通常の検索実行
      console.log("[Scraper] Executing normal search");
      await this.driver.executeScript("LinkSubmit('P004','2','searchBtn');");
    }

    // ページ遷移を待機
    await this.driver.sleep(8000);
    console.log("[Scraper] Search executed");
  }

  /**
   * 結果テーブルを特定
   */
  private async findResultTable(): Promise<WebElement | null> {
    if (!this.driver) throw new Error("Driver not initialized");

    const tables = await this.driver.findElements(By.css("table"));
    console.log(`[Scraper] Found ${tables.length} tables`);

    for (const table of tables) {
      try {
        const firstRow = await table.findElement(By.css("tr"));
        const headerText = await firstRow.getText();
        
        if (headerText.includes("案件名称") && headerText.includes("発注機関")) {
          console.log(`[Scraper] Found result table with header: ${headerText.substring(0, 50)}`);
          return table;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  /**
   * テーブルからデータを抽出
   */
  private async extractDataFromTable(table: WebElement): Promise<ScrapedBiddingItem[]> {
    const items: ScrapedBiddingItem[] = [];
    const rows = await table.findElements(By.css("tr"));
    console.log(`[Scraper] Found ${rows.length} rows in result table`);

    for (let i = 1; i < rows.length; i++) {
      try {
        const cells = await rows[i].findElements(By.css("td"));
        if (cells.length < 9) {
          console.log(`[Scraper] Row ${i} has only ${cells.length} cells, skipping`);
          continue;
        }

        const cellTexts = await Promise.all(
          cells.map(cell => cell.getText())
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
          const link = await cells[3].findElement(By.css("a"));
          detailUrl = await link.getAttribute("href");
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
    if (!this.driver) return false;

    try {
      const nextPageLinks = await this.driver.findElements(
        By.xpath("//a[contains(text(), '次ページ')]")
      );
      return nextPageLinks.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 次ページへ遷移
   */
  private async goToNextPage(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    console.log("[Scraper] Navigating to next page");
    const nextPageLink = await this.driver.findElement(
      By.xpath("//a[contains(text(), '次ページ')]")
    );
    await nextPageLink.click();
    await this.driver.sleep(5000);
  }

  /**
   * 個別案件の詳細情報を取得
   */
  private async fetchDetailInfo(item: ScrapedBiddingItem): Promise<void> {
    if (!this.driver || !item.detailUrl) return;

    try {
      console.log(`[Scraper] Fetching detail for case ${item.caseNumber}`);
      
      // 現在のウィンドウハンドルを保存
      const mainWindow = await this.driver.getWindowHandle();
      
      // 新しいタブで詳細ページを開く
      await this.driver.executeScript(`window.open('${item.detailUrl}', '_blank');`);
      await this.driver.sleep(2000);
      
      // 新しいタブに切り替え
      const handles = await this.driver.getAllWindowHandles();
      await this.driver.switchTo().window(handles[handles.length - 1]);
      
      // 詳細情報を抽出（実装は省略、必要に応じて追加）
      // TODO: 詳細ページの構造に応じて実装
      
      // タブを閉じて元のウィンドウに戻る
      await this.driver.close();
      await this.driver.switchTo().window(mainWindow);
      
      console.log(`[Scraper] Detail fetched for case ${item.caseNumber}`);
    } catch (error) {
      console.error(`[Scraper] Error fetching detail for case ${item.caseNumber}:`, error);
    }
  }

  /**
   * スクレイピングを実行
   */
  async scrape(conditions: SearchConditions = {}, fetchDetails: boolean = false): Promise<ScraperResult> {
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        // WebDriverを初期化
        await this.initDriver();

        // TOPページから遷移するか、直接アクセス
        if (conditions.useLatestAnnouncement) {
          await this.driver!.get(this.baseUrl);
          await this.driver!.wait(until.elementLocated(By.id("searchBtn")), 15000);
        } else {
          await this.navigateFromTopPage();
        }

        // 検索条件を設定
        if (!conditions.useLatestAnnouncement) {
          await this.setSearchConditions(conditions);
        }

        // 検索を実行
        await this.executeSearch(conditions.useLatestAnnouncement ?? true);

        // 全ページのデータを収集
        const allItems: ScrapedBiddingItem[] = [];
        let pageCount = 1;

        do {
          console.log(`[Scraper] Processing page ${pageCount}`);
          
          // 結果テーブルを特定
          const resultTable = await this.findResultTable();
          if (!resultTable) {
            throw new Error("Result table not found");
          }

          // データを抽出
          const pageItems = await this.extractDataFromTable(resultTable);
          allItems.push(...pageItems);

          // 詳細情報を取得（オプション）
          if (fetchDetails) {
            for (const item of pageItems) {
              await this.fetchDetailInfo(item);
            }
          }

          // 次ページがあるかチェック
          if (await this.hasNextPage()) {
            await this.goToNextPage();
            pageCount++;
          } else {
            break;
          }
        } while (true);

        console.log(`[Scraper] Successfully scraped ${allItems.length} items from ${pageCount} pages`);

        return {
          success: true,
          items: allItems,
          totalCount: allItems.length,
        };

      } catch (error) {
        retryCount++;
        console.error(`[Scraper] Error (attempt ${retryCount}/${this.maxRetries}):`, error);

        if (retryCount < this.maxRetries) {
          console.log(`[Scraper] Retrying in ${this.retryDelay / 1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          return {
            success: false,
            items: [],
            totalCount: 0,
            errorMessage: error instanceof Error ? error.message : String(error),
          };
        }
      } finally {
        // WebDriverをクローズ
        if (this.driver) {
          try {
            await this.driver.quit();
            console.log("[Scraper] WebDriver closed");
          } catch (error) {
            console.error("[Scraper] Error closing WebDriver:", error);
          }
          this.driver = null;
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
}

/**
 * スクレイピングを実行する関数（エクスポート用）
 */
export async function scrapeMieBiddings(
  conditions: SearchConditions = {},
  fetchDetails: boolean = false
): Promise<ScraperResult> {
  const scraper = new MieBiddingScraper();
  return await scraper.scrape(conditions, fetchDetails);
}

/**
 * ScrapedBiddingItemをInsertBiddingに変換
 */
export function convertToInsertBidding(item: ScrapedBiddingItem): any {
  return {
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
}
