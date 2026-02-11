# 三重県入札情報サイト 構造解析ドキュメント

**作成日**: 2026年1月17日  
**対象サイト**: [三重県公共調達システム - 入札情報](https://mie.efftis.jp/24000/ppi/pub)  
**作成者**: Manus AI

---

## 1. 概要

三重県公共調達システムの入札情報サイトは、三重県が発注する公共工事や委託業務の入札案件を公開するWebアプリケーションである。本ドキュメントでは、スクレイピングやデータ取得を目的として、サイトの技術的構造を詳細に解析した結果を記録する。

### 1.1 基本情報

| 項目 | 内容 |
|------|------|
| **サイト名** | 三重県公共調達システム - 入札情報 |
| **URL** | https://mie.efftis.jp/24000/ppi/pub |
| **ページタイトル** | 三重県公共調達システム - 入札情報：入札予定（公告）一覧 |
| **文字コード** | UTF-8 |
| **レスポンス形式** | HTML（動的生成） |

### 1.2 技術スタック

本サイトは以下の技術で構築されている。

- **サーバーサイド**: Java（推測）
- **フロントエンド**: HTML、JavaScript（jQuery不使用）
- **データ送信**: POSTメソッドによるフォーム送信
- **ページ遷移**: JavaScript関数によるフォームsubmit
- **セッション管理**: Cookie（推測）

---

## 2. ページ構造

### 2.1 全体構成

三重県入札情報サイトは、**単一ページアプリケーション（SPA）的な動作**をする。検索条件の入力と結果表示が同一URL上で行われ、JavaScript関数によるフォーム送信でコンテンツが動的に切り替わる。

```
https://mie.efftis.jp/24000/ppi/pub
├── 検索フォーム（初期表示）
│   ├── 検索条件入力エリア
│   ├── 検索実行ボタン
│   └── 最新公告情報ボタン
└── 結果表示エリア（検索後）
    ├── 結果件数表示
    ├── 結果テーブル
    └── ページネーション
```

### 2.2 フォーム構造

サイトには**1つの巨大なフォーム**（name="main"）が存在し、すべての検索条件と制御パラメータがこのフォーム内に格納されている。

#### フォーム基本情報

| 属性 | 値 |
|------|-----|
| **name** | main |
| **action** | https://mie.efftis.jp/24000/ppi/pub |
| **method** | POST |
| **入力要素数** | 126個 |

#### 主要な隠しフィールド

フォーム内には、ページ遷移を制御するための隠しフィールドが含まれている。

| フィールド名 | 説明 | 初期値 |
|-------------|------|--------|
| `s` | ページ識別子（page） | 空文字 |
| `a` | アクション識別子（action） | 空文字 |
| `bidFlag` | 入札フラグ | "1" |
| `ankenNo` | 案件番号 | 空文字 |

#### 検索条件フィールド

検索フォームには以下の条件入力欄が用意されている。

| 項目 | フィールド名 | 入力タイプ | 説明 |
|------|-------------|-----------|------|
| **発注区分** | `bidMeansSel` | select | 全て/電子入札/紙入札 |
| **区分** | `bidWay` | select | 全て/一般競争入札/随意契約/指名競争入札/プロポーザル |
| **工事/委託** | `ankenKbn1`, `ankenKbn2` | checkbox | 工事（0）、委託（1） |
| **種別** | `categoryCode`, `categoryName` | hidden + textarea | 種別コードと名称 |
| **格付** | 複数のcheckbox | checkbox | A/B/C/D/指定無し |
| **発注機関** | 複数のフィールド | hidden + textarea | 本庁/地域機関/その他 |
| **部局** | 複数のフィールド | hidden + textarea | 部局コードと名称 |
| **所属** | 複数のフィールド | hidden + textarea | 所属コードと名称 |
| **履行場所** | 複数のフィールド | text | 工事場所の文字列検索 |
| **公開日（公告日）** | 年号、年月日（from/to） | select + text | 日付範囲指定 |
| **更新日** | 年号、年月日（from/to） | select + text | 更新日範囲指定 |
| **電子入札受付期間** | 年号、年月日（from/to） | select + text | 受付期間範囲指定 |
| **開札日（紙入札日）** | 年号、年月日（from/to） | select + text | 開札日範囲指定 |
| **参加申請締切日** | 年号、年月日（from/to） | select + text | 締切日範囲指定 |
| **予定価格** | from/to | text | 金額範囲（半角数字） |
| **施行番号検索** | 施行番号 | text | 半角数字 |
| **件名文字列検索** | 件名 | text | 一部文字列検索 |

---

## 3. JavaScript関数

### 3.1 LinkSubmit関数

サイトの中核となるJavaScript関数は`LinkSubmit`である。この関数は、検索ボタンや最新公告情報ボタンがクリックされた際に呼び出され、フォームを送信してページを遷移させる。

#### 関数定義

```javascript
function LinkSubmit(page, act, id) {
    var toColor = "#800080";
    noLink(id, toColor);
    document.main.s.value = page;
    document.main.a.value = act;
    document.main.submit();
}
```

#### パラメータ

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| `page` | ページ識別子（隠しフィールド`s`に設定） | "P004" |
| `act` | アクション識別子（隠しフィールド`a`に設定） | "2", "4" |
| `id` | ボタンのDOM ID（色変更用） | "searchBtn" |

#### 動作フロー

LinkSubmit関数は以下の手順で動作する。

1. **ボタンの色を変更**（`noLink`関数を呼び出し、紫色に変更）
2. **隠しフィールド`s`に`page`値を設定**
3. **隠しフィールド`a`に`act`値を設定**
4. **フォームを送信**（`document.main.submit()`）
5. **サーバーがPOSTリクエストを処理し、結果ページを返す**

### 3.2 主要なボタンとパラメータ

サイト内の主要なボタンは、それぞれ異なるパラメータで`LinkSubmit`関数を呼び出す。

| ボタン名 | JavaScript呼び出し | page | act | 説明 |
|---------|-------------------|------|-----|------|
| **検索を実行** | `LinkSubmit('P004','2','searchBtn')` | P004 | 2 | 検索条件に基づいて検索を実行 |
| **最新公告情報** | `LinkSubmit('P004','4','searchBtn')` | P004 | 4 | 最新の入札公告を取得（条件不要） |

---

## 4. テーブル構造

### 4.1 ページ内のテーブル一覧

ページには**5つのテーブル**が存在する。それぞれの役割は以下の通りである。

| インデックス | 行数 | 役割 | 識別方法 |
|-------------|------|------|---------|
| **0** | 17行 | 検索条件入力フォーム | ヘッダーに「発注区分」を含む |
| **1** | 1行 | ボタン配置（検索実行、最新公告情報） | ヘッダーに「検索を実行」を含む |
| **2** | 1行 | ページネーション（上部） | ヘッダーに「次ページ」を含む |
| **3** | 11行 | **結果テーブル（メイン）** | ヘッダーに「案件名称」「発注機関」を含む |
| **4** | 1行 | ページネーション（下部） | ヘッダーに「次ページ」を含む |

### 4.2 結果テーブル（インデックス3）の詳細

結果テーブルは、入札案件の一覧を表示するメインテーブルである。

#### ヘッダー行（1行目）

| 列番号 | ヘッダー名 | 説明 |
|--------|-----------|------|
| 0 | No | 連番 |
| 1 | 発注機関施行番号 | 発注機関名と施行番号（8桁の数字） |
| 2 | 質問有無 | 質問の有無（「-」または「有」） |
| 3 | 案件名称 | 案件のタイトル（リンク付き） |
| 4 | 入札方式等 | 入札方式（例: 一般競争入札、指名競争入札） |
| 5 | 種別 | 工事種別（例: 土木一式工事、ほ装工事） |
| 6 | 格付 | 格付等級（例: Ａ、Ｂ、Ａ、Ｂ） |
| 7 | 参加申請期間 | 申請期間（例: R8/1/16 8:30～R8/1/29 12:00） |
| 8 | 受付状況 | 現在の状態（例: 受付中） |

#### データ行の構造

各データ行は9つのセル（`<td>`）で構成される。以下は実際のデータ例である。

**例: 1行目のデータ**

| 列 | 内容 |
|----|------|
| 0 | 1 |
| 1 | 伊勢建設事務所50705317 |
| 2 | - |
| 3 | 【添付ファイルの修正 R8.1.16更新】 公告日　令和8/1/16 【総合評価（簡易型・技術資料の事後審査型)】 【技術者の実績設定なし】 【建設キャリアアップシステム】 令和7年度県単河川（緊自） 第 47－16分0004号 二級河川河内川河川局部改良（堤防強化対策）工事 |
| 4 | 一般競争入札（総合評価(除算)） |
| 5 | 土木一式工事 |
| 6 | Ａ、Ｂ |
| 7 | R8/1/16  8:30～R8/1/29  12:00 |
| 8 | 受付中 |

#### 発注機関と施行番号の分割

**重要**: 列1（発注機関施行番号）は、発注機関名と8桁の施行番号が**改行なし**で連結されている。

```
例: "伊勢建設事務所50705317"
  ↓
発注機関: 伊勢建設事務所
施行番号: 50705317
```

正規表現で施行番号（末尾8桁の数字）を抽出する必要がある。

```javascript
const organAndNumber = "伊勢建設事務所50705317";
const match = organAndNumber.match(/(\d{8})$/);
const caseNumber = match ? match[1] : ""; // "50705317"
const orderOrganName = match 
  ? organAndNumber.substring(0, organAndNumber.length - 8) 
  : organAndNumber; // "伊勢建設事務所"
```

---

## 5. ページネーション

### 5.1 構造

結果が複数ページにわたる場合、ページネーションが表示される。

**例**: 全76件の場合、8ページに分割される（1ページあたり10件）。

```
（全76件）  10件

（1/8ページ）

 | 次ページ
```

### 5.2 次ページへの遷移

次ページへの遷移は、「次ページ」リンクをクリックすることで実行される。このリンクも`LinkSubmit`関数を呼び出すと推測される（パラメータは未確認）。

---

## 6. スクレイピング戦略

### 6.1 推奨アプローチ

三重県入札情報サイトからデータを取得する際の推奨手順は以下の通りである。

#### ステップ1: 初期ページへのアクセス

```
GET https://mie.efftis.jp/24000/ppi/pub
```

Cookieを保存し、セッションを維持する。

#### ステップ2: 最新公告情報の取得

JavaScript関数`LinkSubmit('P004','4','searchBtn')`を実行する。Seleniumを使用する場合は以下のコードで実行可能である。

```javascript
driver.executeScript("LinkSubmit('P004','4','searchBtn');");
```

#### ステップ3: 結果テーブルの待機

フォーム送信後、ページが動的に更新されるまで**5〜8秒**待機する。

```javascript
await driver.sleep(8000);
```

#### ステップ4: 結果テーブルの特定

ページ内の5つのテーブルから、ヘッダー行に「案件名称」と「発注機関」を含むテーブルを特定する。

```javascript
const tables = await driver.findElements(By.css("table"));
for (const table of tables) {
  const firstRow = await table.findElement(By.css("tr"));
  const headerText = await firstRow.getText();
  if (headerText.includes("案件名称") && headerText.includes("発注機関")) {
    resultTable = table;
    break;
  }
}
```

#### ステップ5: データ行の解析

結果テーブルの2行目以降（ヘッダー行をスキップ）を順次解析する。

```javascript
const rows = await resultTable.findElements(By.css("tr"));
for (let i = 1; i < rows.length; i++) {
  const cells = await rows[i].findElements(By.css("td"));
  if (cells.length < 9) continue; // 9列未満はスキップ
  
  const cellTexts = await Promise.all(cells.map(cell => cell.getText()));
  
  // データ抽出
  const no = cellTexts[0].trim();
  const organAndNumber = cellTexts[1].trim();
  const title = cellTexts[3].trim();
  // ... 以下省略
}
```

#### ステップ6: ページネーション対応

全ページを取得する場合は、「次ページ」リンクをクリックし、ステップ3〜5を繰り返す。

### 6.2 注意事項

スクレイピングを実行する際は、以下の点に注意する必要がある。

#### 検索条件の必須性

無条件での検索は不可である。検索ボタン（`LinkSubmit('P004','2','searchBtn')`）を実行する場合、**施行番号または日付条件のいずれかが必須**である。条件が不足している場合、以下のエラーメッセージが表示される。

> **「指定された条件に誤りがあります。内容を修正して再検索を行って下さい。」**  
> **「施行番号、又はいずれかの日付条件を指定してください。」**

最新公告情報ボタン（`LinkSubmit('P004','4','searchBtn')`）を使用すれば、条件なしで最新の入札情報を取得できる。

#### セッション管理

サイトはCookieベースのセッション管理を行っていると推測される。WebDriverのセッションを維持し、Cookieを保持する必要がある。

#### 待機時間の調整

JavaScript実行後、ページの動的更新には時間がかかる。待機時間が不足すると、古いテーブルを取得してしまう可能性がある。推奨待機時間は**8秒**である。

#### ロボット対策

頻繁なアクセスはサーバーに負荷をかける可能性がある。適切な間隔（例: 1リクエストあたり10秒以上）を設けることが推奨される。

---

## 7. データフォーマット

### 7.1 日付形式

サイト内の日付は**和暦（令和）**で表記されている。

**例**: `R8/1/16` → 令和8年1月16日 → 2026年1月16日

#### 和暦→西暦変換

```javascript
function convertReiwaToGregorian(reiwaYear, month, day) {
  const year = reiwaYear + 2018; // 令和元年 = 2019年
  return new Date(year, month - 1, day);
}

// 例: R8/1/16 → 2026-01-16
const date = convertReiwaToGregorian(8, 1, 16);
```

### 7.2 参加申請期間のパース

参加申請期間は以下の形式で記載されている。

```
R8/1/16  8:30～R8/1/29  12:00
```

終了日（締切日）を抽出する場合は、正規表現を使用する。

```javascript
const periodStr = "R8/1/16  8:30～R8/1/29  12:00";
const match = periodStr.match(/～\s*R(\d+)\/(\d+)\/(\d+)/);
if (match) {
  const reiwaYear = parseInt(match[1]); // 8
  const month = parseInt(match[2]);     // 1
  const day = parseInt(match[3]);       // 29
  const year = reiwaYear + 2018;        // 2026
  const biddingDate = new Date(year, month - 1, day);
}
```

---

## 8. まとめ

三重県入札情報サイトは、JavaScript関数`LinkSubmit`によるフォーム送信で動的にコンテンツを切り替える構造を持つ。スクレイピングを実行する際は、以下のポイントを押さえる必要がある。

1. **最新公告情報ボタンを使用**して条件なしで最新データを取得
2. **ヘッダー行の内容でテーブルを特定**し、結果テーブルを正確に識別
3. **発注機関と施行番号の分割**に正規表現を使用
4. **十分な待機時間**（8秒）を確保してページの動的更新を待つ
5. **和暦→西暦変換**を実装して日付データを標準化

本ドキュメントで記載した構造情報とスクレイピング戦略を活用することで、安定したデータ取得が可能となる。

---

## 付録A: サンプルコード（Selenium + Node.js）

以下は、Seleniumを使用して三重県入札情報サイトから最新の入札情報を取得するサンプルコードである。

```javascript
import { Builder, By, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

async function scrapeMieBiddingSite() {
  const options = new chrome.Options();
  options.addArguments("--headless");
  options.addArguments("--no-sandbox");
  options.addArguments("--disable-dev-shm-usage");

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    // 1. 初期ページにアクセス
    await driver.get("https://mie.efftis.jp/24000/ppi/pub");
    await driver.wait(until.elementLocated(By.id("searchBtn")), 15000);

    // 2. 最新公告情報ボタンを実行
    await driver.executeScript("LinkSubmit('P004','4','searchBtn');");
    await driver.sleep(8000);

    // 3. 結果テーブルを特定
    const tables = await driver.findElements(By.css("table"));
    let resultTable = null;
    
    for (const table of tables) {
      const firstRow = await table.findElement(By.css("tr"));
      const headerText = await firstRow.getText();
      if (headerText.includes("案件名称") && headerText.includes("発注機関")) {
        resultTable = table;
        break;
      }
    }

    if (!resultTable) {
      throw new Error("Result table not found");
    }

    // 4. データ行を解析
    const rows = await resultTable.findElements(By.css("tr"));
    const biddings = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = await rows[i].findElements(By.css("td"));
      if (cells.length < 9) continue;

      const cellTexts = await Promise.all(
        cells.map(cell => cell.getText())
      );

      // 発注機関と施行番号を分割
      const organAndNumber = cellTexts[1].trim();
      const match = organAndNumber.match(/(\d{8})$/);
      const caseNumber = match ? match[1] : "";
      const orderOrganName = match 
        ? organAndNumber.substring(0, organAndNumber.length - 8)
        : organAndNumber;

      biddings.push({
        no: cellTexts[0].trim(),
        caseNumber,
        orderOrganName,
        title: cellTexts[3].trim(),
        biddingMethod: cellTexts[4].trim(),
        constructionType: cellTexts[5].trim(),
        rating: cellTexts[6].trim(),
        applicationPeriod: cellTexts[7].trim(),
        status: cellTexts[8].trim()
      });
    }

    console.log(`取得件数: ${biddings.length}件`);
    return biddings;

  } finally {
    await driver.quit();
  }
}

// 実行
scrapeMieBiddingSite().then(biddings => {
  console.log(JSON.stringify(biddings, null, 2));
});
```

---

## 付録B: 用語集

| 用語 | 説明 |
|------|------|
| **施行番号** | 入札案件を一意に識別する8桁の番号 |
| **発注機関** | 入札を発注する三重県の部局や事務所 |
| **格付** | 建設業者の等級（A、B、C、D、指定無し） |
| **総合評価** | 価格だけでなく技術力も評価する入札方式 |
| **一般競争入札** | 条件を満たす全ての業者が参加できる入札方式 |
| **指名競争入札** | 発注者が指名した業者のみが参加できる入札方式 |
| **随意契約** | 競争入札を行わず、特定の業者と契約する方式 |
| **プロポーザル** | 技術提案を求める選定方式 |

---

**ドキュメント終了**
