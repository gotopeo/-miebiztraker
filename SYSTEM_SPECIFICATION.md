# MieBid Tracker (MBT) - 完全仕様書

三重県入札情報取得システム

**バージョン**: 1.0  
**作成日**: 2026年1月18日  
**作成者**: Manus AI

---

## 目次

1. [システム概要](#システム概要)
2. [技術スタック](#技術スタック)
3. [システムアーキテクチャ](#システムアーキテクチャ)
4. [データベース設計](#データベース設計)
5. [スクレイピング機能](#スクレイピング機能)
6. [API仕様](#api仕様)
7. [フロントエンド構造](#フロントエンド構造)
8. [環境構築手順](#環境構築手順)
9. [デプロイ手順](#デプロイ手順)
10. [運用・保守](#運用保守)

---

## システム概要

### 目的

三重県入札情報取得システムは、三重県公共調達システム（https://mie.efftis.jp）から入札情報を自動的に収集し、検索・管理・通知を行うWebアプリケーションである。本システムにより、入札案件の見逃しを防ぎ、効率的な入札参加が可能となる。

### 主要機能

本システムは以下の機能を提供する。

**スクレイピング機能**では、Selenium WebDriverを使用して三重県入札情報サイトから最新の公告情報を自動取得する。フレームセット構造やセッション管理に対応し、最大3回のリトライ処理により安定した動作を実現している。ページネーション機能により、複数ページにわたる案件情報を一括取得できる。

**検索・フィルタリング機能**では、キーワード、発注機関コード、日付範囲、状態による絞り込みが可能である。詳細検索条件として、格付、工事種別、予定価格範囲、履行場所などの指定にも対応している。

**データエクスポート機能**では、検索結果をCSV形式またはExcel形式でダウンロードできる。Excel形式では、ExcelJSライブラリを使用して、ヘッダー付きの整形されたワークブックを生成する。

**キーワード監視機能**では、ユーザーが登録したキーワードに一致する新規案件を検出する仕組みを提供する。現時点では監視設定のみ実装されており、通知機能は今後の実装予定である。

**スケジュール設定機能**では、定期的なスクレイピング実行のスケジュールを設定できるUIを提供する。現時点では設定UIのみ実装されており、実際の自動実行機能は今後の実装予定である。

**スクレイピング履歴管理機能**では、過去のスクレイピング実行履歴、取得件数、エラーログを記録・表示する。実行タイプ（手動/自動）、ステータス（実行中/成功/失敗）、エラー詳細を管理できる。

### システムの特徴

本システムは、三重県入札情報サイトの特殊な構造に対応している。具体的には、JavaScript動的生成によるページ遷移、セッション管理が必要な検索機能、発注機関と施行番号が改行なしで連結されたテーブル構造などに対応した実装となっている。

エラーハンドリングについては、最大3回のリトライ処理、詳細なエラーログ記録、タイムアウト処理（8秒待機）により、安定した動作を保証している。

データの永続化については、MySQL/TiDBデータベースを使用し、重複チェック機能により同一案件の重複登録を防止している。取得した入札情報、スクレイピング履歴、キーワード監視設定、スケジュール設定をすべてデータベースで管理している。

---

## 技術スタック

### フロントエンド

フロントエンドは、React 19とTypeScriptを使用したモダンなSPA（Single Page Application）として構築されている。UIコンポーネントライブラリとしてshadcn/uiを採用し、Radix UIをベースとした高品質なコンポーネントを使用している。スタイリングにはTailwind CSS 4を使用し、レスポンシブデザインに対応している。

ルーティングにはwouter 3.3.5を使用し、軽量で高速なクライアントサイドルーティングを実現している。アイコンにはlucide-reactを採用し、一貫性のあるビジュアルデザインを提供している。

### バックエンド

バックエンドは、Node.js 22.13.0とExpress 4を使用して構築されている。APIフレームワークとしてtRPC 11を採用し、型安全なエンドツーエンドのAPI通信を実現している。SuperJSONを使用することで、Date型などの複雑なデータ型をシリアライズ・デシリアライズできる。

認証機能には、Manus OAuthを使用し、セッション管理はJWT（Jose 6.1.0）で実装している。バリデーションにはZod 4を使用し、実行時の型チェックとバリデーションを行っている。

### データベース

データベースには、MySQL 8.0互換のTiDBを使用している。ORMとしてDrizzle ORM 0.44.5を採用し、型安全なクエリビルダーを提供している。マイグレーション管理にはDrizzle Kit 0.31.4を使用し、スキーマの変更履歴を管理している。

### スクレイピング

スクレイピングエンジンには、Selenium WebDriver 4.27.0を使用している。ブラウザドライバーとしてChromeDriver 128を採用し、Chromium 128.0.6613.137と組み合わせて動作する。

### ファイル処理

Excelファイルの生成には、ExcelJS 4.4.0を使用している。CSVファイルは、標準的なカンマ区切り形式で生成し、BOM（Byte Order Mark）を付加することでExcelでの文字化けを防止している。

### 開発ツール

TypeScript 5.9.3を使用して型安全な開発を実現している。ビルドツールにはVite 7.1.7を採用し、高速な開発サーバーとビルドを提供している。テストフレームワークにはVitest 2.1.4を使用し、単体テストを実装している。パッケージマネージャーにはpnpm 10.4.1を使用し、効率的な依存関係管理を行っている。

---

## システムアーキテクチャ

### 全体構成

本システムは、クライアント・サーバー・データベースの3層アーキテクチャを採用している。

**クライアント層**では、Reactで構築されたSPAがブラウザ上で動作し、tRPCクライアントを通じてサーバーと通信する。ユーザー認証はManus OAuthを使用し、セッションCookieで管理される。

**サーバー層**では、Express + tRPCサーバーがAPIエンドポイントを提供する。スクレイピング処理はSeleniumを使用してバックグラウンドで実行され、取得したデータはDrizzle ORMを通じてデータベースに保存される。

**データベース層**では、MySQL/TiDBが入札情報、スクレイピング履歴、ユーザー設定を永続化する。

### ディレクトリ構造

```
mie_bidding_system/
├── client/                    # フロントエンドコード
│   ├── public/               # 静的ファイル
│   └── src/
│       ├── pages/            # ページコンポーネント
│       │   ├── Home.tsx
│       │   ├── BiddingList.tsx
│       │   ├── ScrapingLogs.tsx
│       │   ├── KeywordSettings.tsx
│       │   └── ScheduleSettings.tsx
│       ├── components/       # 再利用可能なUIコンポーネント
│       │   └── ui/          # shadcn/uiコンポーネント
│       ├── lib/             # ユーティリティ
│       │   └── trpc.ts      # tRPCクライアント設定
│       ├── App.tsx          # ルーティング設定
│       ├── main.tsx         # エントリーポイント
│       └── index.css        # グローバルスタイル
├── server/                   # バックエンドコード
│   ├── _core/               # フレームワークコア（編集不要）
│   ├── routers.ts           # tRPC APIルーター
│   ├── db.ts                # データベースクエリヘルパー
│   ├── scraper.ts           # スクレイピング機能
│   ├── scraper.test.ts      # スクレイピングテスト
│   └── biddings.test.ts     # API単体テスト
├── drizzle/                 # データベーススキーマ
│   └── schema.ts            # テーブル定義
├── shared/                  # 共通定義
│   └── const.ts             # 定数定義
├── package.json             # 依存関係定義
├── tsconfig.json            # TypeScript設定
└── README.md                # プロジェクト説明
```

### データフロー

**スクレイピング実行時**のデータフローは以下の通りである。

1. ユーザーがフロントエンドで「スクレイピング実行」ボタンをクリック
2. tRPC mutation `scraping.execute` が呼び出される
3. サーバー側で `scrapeMieBiddings()` 関数が実行される
4. Seleniumが三重県入札情報サイトにアクセス
5. 最新公告情報ボタンをクリックし、結果ページを取得
6. テーブルデータを解析し、`ScrapedBiddingItem[]` 配列を生成
7. `insertBiddingsBatch()` でデータベースに一括保存
8. スクレイピング履歴を `scraping_logs` テーブルに記録
9. 結果（取得件数、新規件数、重複件数）をフロントエンドに返却
10. フロントエンドで結果を表示し、トースト通知を表示

**検索・表示時**のデータフローは以下の通りである。

1. ユーザーが検索条件を入力し、「検索」ボタンをクリック
2. tRPC query `biddings.search` が呼び出される
3. サーバー側で `searchBiddings()` 関数が実行される
4. Drizzle ORMでデータベースクエリを構築・実行
5. ページネーション処理を適用
6. 結果をフロントエンドに返却
7. フロントエンドでテーブル形式で表示

**エクスポート時**のデータフローは以下の通りである。

1. ユーザーが「Excelエクスポート」ボタンをクリック
2. tRPC mutation `biddings.exportExcel` が呼び出される
3. サーバー側で検索条件に基づいてデータを取得
4. ExcelJSでワークブックを生成
5. バッファをBase64エンコードしてフロントエンドに返却
6. フロントエンドでBase64をBlobに変換
7. ブラウザのダウンロード機能でファイルを保存

---

## データベース設計

### ER図

```
users (ユーザー)
  ├── id (PK)
  ├── openId (UNIQUE)
  ├── name
  ├── email
  ├── role
  └── timestamps

biddings (入札情報)
  ├── id (PK)
  ├── caseNumber (UNIQUE)
  ├── title
  ├── orderOrganCode
  ├── orderOrganName
  ├── biddingMethod
  ├── constructionType
  ├── rating
  ├── applicationPeriod
  ├── status
  ├── biddingDate
  ├── estimatedPrice
  ├── location
  ├── remarks
  ├── detailUrl
  └── timestamps

scraping_logs (スクレイピング履歴)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── executionType
  ├── status
  ├── itemsScraped
  ├── newItems
  ├── errorMessage
  ├── errorDetails
  └── timestamps

keyword_watches (キーワード監視)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── keyword
  ├── enabled
  └── timestamps

notification_settings (通知設定)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── emailEnabled
  ├── slackEnabled
  ├── slackWebhookUrl
  └── timestamps

schedule_settings (スケジュール設定)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── frequency
  ├── time
  ├── enabled
  └── timestamps

search_history (検索条件履歴)
  ├── id (PK)
  ├── userId (FK → users.id)
  ├── conditions (JSON)
  └── timestamps
```

### テーブル定義

#### users（ユーザー）

ユーザーテーブルは、Manus OAuth認証によるユーザー情報を管理する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | ユーザーID |
| openId | VARCHAR(64) | NOT NULL, UNIQUE | Manus OAuth識別子 |
| name | TEXT | NULL | ユーザー名 |
| email | VARCHAR(320) | NULL | メールアドレス |
| loginMethod | VARCHAR(64) | NULL | ログイン方法 |
| role | ENUM('user', 'admin') | NOT NULL, DEFAULT 'user' | ユーザー権限 |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | 更新日時 |
| lastSignedIn | TIMESTAMP | NOT NULL, DEFAULT NOW() | 最終ログイン日時 |

#### biddings（入札情報）

入札情報テーブルは、三重県入札情報サイトから取得した案件情報を保存する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 入札情報ID |
| caseNumber | VARCHAR(50) | NOT NULL, UNIQUE | 案件番号（施行番号） |
| title | TEXT | NOT NULL | 案件名 |
| orderOrganCode | VARCHAR(20) | NULL | 発注機関コード |
| orderOrganName | VARCHAR(255) | NULL | 発注機関名 |
| biddingMethod | VARCHAR(100) | NULL | 入札方式 |
| constructionType | VARCHAR(100) | NULL | 工事種別 |
| rating | VARCHAR(50) | NULL | 格付 |
| applicationPeriod | TEXT | NULL | 参加申請期間 |
| status | VARCHAR(50) | NULL | 受付状況 |
| biddingDate | TIMESTAMP | NULL | 入札日 |
| estimatedPrice | VARCHAR(50) | NULL | 予定価格 |
| location | TEXT | NULL | 履行場所 |
| remarks | TEXT | NULL | 備考 |
| detailUrl | TEXT | NULL | 詳細ページURL |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | 更新日時 |

#### scraping_logs（スクレイピング履歴）

スクレイピング履歴テーブルは、スクレイピング実行の履歴とエラーログを記録する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | ログID |
| userId | INT | NOT NULL, FOREIGN KEY → users.id | 実行ユーザーID |
| executionType | ENUM('manual', 'scheduled') | NOT NULL | 実行タイプ |
| status | ENUM('running', 'success', 'failed') | NOT NULL | ステータス |
| startedAt | TIMESTAMP | NOT NULL | 開始日時 |
| finishedAt | TIMESTAMP | NULL | 終了日時 |
| itemsScraped | INT | NULL | 取得件数 |
| newItems | INT | NULL | 新規件数 |
| errorMessage | TEXT | NULL | エラーメッセージ |
| errorDetails | TEXT | NULL | エラー詳細（スタックトレース） |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |

#### keyword_watches（キーワード監視）

キーワード監視テーブルは、ユーザーが登録した監視キーワードを管理する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 監視ID |
| userId | INT | NOT NULL, FOREIGN KEY → users.id | ユーザーID |
| keyword | VARCHAR(255) | NOT NULL | 監視キーワード |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | 有効/無効 |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | 更新日時 |

#### notification_settings（通知設定）

通知設定テーブルは、ユーザーごとの通知設定を管理する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 設定ID |
| userId | INT | NOT NULL, FOREIGN KEY → users.id | ユーザーID |
| emailEnabled | BOOLEAN | NOT NULL, DEFAULT FALSE | メール通知有効 |
| slackEnabled | BOOLEAN | NOT NULL, DEFAULT FALSE | Slack通知有効 |
| slackWebhookUrl | TEXT | NULL | Slack Webhook URL |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | 更新日時 |

#### schedule_settings（スケジュール設定）

スケジュール設定テーブルは、定期実行のスケジュールを管理する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 設定ID |
| userId | INT | NOT NULL, FOREIGN KEY → users.id | ユーザーID |
| frequency | ENUM('daily', 'weekly', 'monthly') | NOT NULL | 実行頻度 |
| time | VARCHAR(10) | NOT NULL | 実行時刻（HH:MM形式） |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | 有効/無効 |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() | 更新日時 |

#### search_history（検索条件履歴）

検索条件履歴テーブルは、ユーザーの検索条件を記録する。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 履歴ID |
| userId | INT | NOT NULL, FOREIGN KEY → users.id | ユーザーID |
| conditions | JSON | NOT NULL | 検索条件（JSON形式） |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 作成日時 |

---

## スクレイピング機能

### 概要

スクレイピング機能は、Selenium WebDriverを使用して三重県入札情報サイト（https://mie.efftis.jp/24000/ppi/pub）から入札案件情報を自動取得する。サイトの特殊な構造（JavaScript動的生成、セッション管理）に対応し、安定した動作を実現している。

### 実装ファイル

スクレイピング機能は `server/scraper.ts` に実装されている。主要な関数は以下の通りである。

**`scrapeMieBiddings(conditions, fetchDetails)`** は、メイン関数であり、指定された検索条件でスクレイピングを実行する。引数として、`conditions: SearchConditions`（検索条件）と`fetchDetails: boolean`（詳細情報取得フラグ）を受け取る。戻り値は `ScrapingResult` 型であり、成功時には `{ success: true, items: ScrapedBiddingItem[], totalCount: number }` を返し、失敗時には `{ success: false, errorMessage: string }` を返す。

**`convertToInsertBidding(item)`** は、スクレイピング結果をデータベース挿入用の型に変換する関数である。

### 検索条件

`SearchConditions` インターフェースは以下のプロパティを持つ。

```typescript
interface SearchConditions {
  useLatestAnnouncement?: boolean;  // 最新公告情報ボタンを使用
  projectType?: string[];           // 工事種別（複数選択可）
  titleKeyword?: string;            // 件名キーワード
  location?: string;                // 履行場所
  constructionNo?: string;          // 施行番号
  estimatedPriceMin?: number;       // 予定価格（最小）
  estimatedPriceMax?: number;       // 予定価格（最大）
  rating?: string[];                // 格付（複数選択可）
}
```

### スクレイピングフロー

スクレイピング処理は以下の手順で実行される。

**1. WebDriverの初期化**では、ChromeDriverを起動し、ヘッドレスモードで動作させる。タイムアウトは30秒に設定される。

**2. サイトへのアクセス**では、三重県入札情報サイトのトップページ（https://mie.efftis.jp/24000/ppi/pub）にアクセスする。

**3. 検索条件の設定**では、`useLatestAnnouncement` が `true` の場合、最新公告情報ボタン（`LinkSubmit('P004','4','searchBtn')`）をクリックする。`false` の場合、検索フォームに条件を入力し、検索ボタンをクリックする。

**4. 結果ページの待機**では、結果テーブルが表示されるまで最大8秒間待機する。

**5. テーブルデータの抽出**では、ヘッダー行に「案件名称」「発注機関」を含むテーブルを特定し、各行から以下のデータを抽出する。

- No（連番）
- 発注機関・施行番号（改行なしで連結）
- 質問有無
- 案件名称（リンク付き）
- 入札方式等
- 種別
- 格付
- 参加申請期間
- 受付状況

**6. ページネーション処理**では、「次ページ」ボタンが存在する場合、クリックして次ページに遷移し、手順5を繰り返す。すべてのページを処理するまで継続する。

**7. 詳細情報の取得（オプション）**では、`fetchDetails` が `true` の場合、各案件の詳細ページにアクセスし、追加情報（予定価格、履行場所、備考など）を取得する。

**8. WebDriverのクリーンアップ**では、処理完了後、WebDriverを終了する。

### エラーハンドリング

エラーハンドリングは以下の方針で実装されている。

**リトライ処理**では、スクレイピング失敗時、最大3回まで自動的にリトライする。各リトライの間隔は5秒である。

**タイムアウト処理**では、要素の待機時間は8秒に設定されている。ページ全体のタイムアウトは30秒である。

**エラーログ記録**では、エラーメッセージとスタックトレースを `scraping_logs` テーブルに記録する。エラー詳細には、失敗したURL、要素セレクタ、タイムアウト時間などを含む。

**WebDriverのクリーンアップ**では、エラー発生時でも必ず `driver.quit()` を実行し、リソースリークを防止する。

### データ抽出ロジック

テーブル行からのデータ抽出は以下のロジックで行われる。

**発注機関と施行番号の分離**では、セル内のテキストから8桁の数字を施行番号として抽出する。残りの部分を発注機関名とする。例：「伊勢建設事務所50705317」→ 発注機関「伊勢建設事務所」、施行番号「50705317」。

**案件名称とURLの抽出**では、案件名称セル内の `<a>` タグから案件名とリンクURLを取得する。相対URLの場合、ベースURL（https://mie.efftis.jp）を付加する。

**日付の解析**では、参加申請期間や入札日は和暦形式（例：「令和7年1月20日」）で記載されている。現時点では文字列としてそのまま保存し、今後の実装で西暦変換を行う予定である。

---

## API仕様

### tRPC APIエンドポイント

本システムは、tRPCを使用して型安全なAPIを提供している。すべてのAPIエンドポイントは `/api/trpc` 配下に配置される。

### 認証API（`auth`）

#### `auth.me`

現在ログイン中のユーザー情報を取得する。

- **タイプ**: Query
- **認証**: 不要（publicProcedure）
- **入力**: なし
- **出力**: `User | null`

```typescript
const { data: user } = trpc.auth.me.useQuery();
```

#### `auth.logout`

ログアウト処理を実行する。

- **タイプ**: Mutation
- **認証**: 不要（publicProcedure）
- **入力**: なし
- **出力**: `{ success: true }`

```typescript
const logoutMutation = trpc.auth.logout.useMutation();
await logoutMutation.mutateAsync();
```

### 入札情報API（`biddings`）

#### `biddings.search`

入札情報を検索する。

- **タイプ**: Query
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    keyword?: string;
    orderOrganCode?: string;
    startDate?: string;  // YYYY-MM-DD形式
    endDate?: string;    // YYYY-MM-DD形式
    status?: string;
    page?: number;       // デフォルト: 1
    pageSize?: number;   // デフォルト: 20
  }
  ```
- **出力**:
  ```typescript
  {
    items: Bidding[];
    total: number;
    page: number;
    pageSize: number;
  }
  ```

```typescript
const { data } = trpc.biddings.search.useQuery({
  keyword: "道路",
  page: 1,
  pageSize: 20,
});
```

#### `biddings.exportCsv`

検索結果をCSV形式で取得する。

- **タイプ**: Query
- **認証**: 必要（protectedProcedure）
- **入力**: `biddings.search` と同じ（ページネーションなし）
- **出力**: `Bidding[]`

```typescript
const { data } = await trpc.biddings.exportCsv.useQuery({
  keyword: "道路",
});
```

#### `biddings.exportExcel`

検索結果をExcel形式で取得する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**: `biddings.search` と同じ（ページネーションなし）
- **出力**:
  ```typescript
  {
    success: boolean;
    data: string;      // Base64エンコードされたExcelファイル
    filename: string;  // ファイル名（例: mie_bidding_2026-01-18.xlsx）
  }
  ```

```typescript
const exportMutation = trpc.biddings.exportExcel.useMutation();
const result = await exportMutation.mutateAsync({
  keyword: "道路",
});
// Base64をBlobに変換してダウンロード
```

### スクレイピングAPI（`scraping`）

#### `scraping.execute`

最新公告情報をスクレイピングする（手動実行）。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**: なし
- **出力**:
  ```typescript
  {
    success: boolean;
    itemsScraped?: number;  // 取得件数
    newItems?: number;      // 新規件数
    duplicates?: number;    // 重複件数
    error?: string;         // エラーメッセージ
  }
  ```

```typescript
const scrapeMutation = trpc.scraping.execute.useMutation();
const result = await scrapeMutation.mutateAsync();
```

#### `scraping.executeWithConditions`

詳細検索条件を指定してスクレイピングする。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    projectType?: string[];
    titleKeyword?: string;
    location?: string;
    constructionNo?: string;
    estimatedPriceMin?: number;
    estimatedPriceMax?: number;
    rating?: string[];
    fetchDetails?: boolean;  // デフォルト: false
  }
  ```
- **出力**: `scraping.execute` と同じ

```typescript
const scrapeMutation = trpc.scraping.executeWithConditions.useMutation();
const result = await scrapeMutation.mutateAsync({
  titleKeyword: "道路",
  rating: ["A", "B"],
  fetchDetails: true,
});
```

#### `scraping.getLogs`

スクレイピング履歴を取得する。

- **タイプ**: Query
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    limit?: number;  // デフォルト: 50
  }
  ```
- **出力**: `ScrapingLog[]`

```typescript
const { data: logs } = trpc.scraping.getLogs.useQuery({ limit: 50 });
```

### キーワード監視API（`keywords`）

#### `keywords.list`

ユーザーのキーワード監視一覧を取得する。

- **タイプ**: Query
- **認証**: 必要（protectedProcedure）
- **入力**: なし
- **出力**: `KeywordWatch[]`

```typescript
const { data: keywords } = trpc.keywords.list.useQuery();
```

#### `keywords.add`

キーワード監視を追加する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    keyword: string;
    enabled?: boolean;  // デフォルト: true
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const addMutation = trpc.keywords.add.useMutation();
await addMutation.mutateAsync({ keyword: "道路工事" });
```

#### `keywords.update`

キーワード監視を更新する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    id: number;
    keyword?: string;
    enabled?: boolean;
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const updateMutation = trpc.keywords.update.useMutation();
await updateMutation.mutateAsync({ id: 1, enabled: false });
```

#### `keywords.delete`

キーワード監視を削除する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    id: number;
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const deleteMutation = trpc.keywords.delete.useMutation();
await deleteMutation.mutateAsync({ id: 1 });
```

### スケジュール設定API（`schedule`）

#### `schedule.list`

ユーザーのスケジュール設定一覧を取得する。

- **タイプ**: Query
- **認証**: 必要（protectedProcedure）
- **入力**: なし
- **出力**: `ScheduleSetting[]`

```typescript
const { data: schedules } = trpc.schedule.list.useQuery();
```

#### `schedule.add`

スケジュール設定を追加する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;  // HH:MM形式
    enabled?: boolean;  // デフォルト: true
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const addMutation = trpc.schedule.add.useMutation();
await addMutation.mutateAsync({
  frequency: 'daily',
  time: '09:00',
});
```

#### `schedule.update`

スケジュール設定を更新する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    id: number;
    frequency?: 'daily' | 'weekly' | 'monthly';
    time?: string;
    enabled?: boolean;
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const updateMutation = trpc.schedule.update.useMutation();
await updateMutation.mutateAsync({ id: 1, enabled: false });
```

#### `schedule.delete`

スケジュール設定を削除する。

- **タイプ**: Mutation
- **認証**: 必要（protectedProcedure）
- **入力**:
  ```typescript
  {
    id: number;
  }
  ```
- **出力**: `{ success: boolean }`

```typescript
const deleteMutation = trpc.schedule.delete.useMutation();
await deleteMutation.mutateAsync({ id: 1 });
```

---

## フロントエンド構造

### ページ構成

本システムは以下のページで構成されている。

#### Home（`/`）

ダッシュボードページであり、システムの概要と主要機能へのリンクを提供する。

**主要機能**：
- 入札情報検索へのリンク
- スクレイピング実行へのリンク
- キーワード監視設定へのリンク
- スケジュール設定へのリンク
- CSVエクスポートへのリンク
- データ蓄積状況の表示

**使用コンポーネント**：
- `Card` - 機能カード
- `Button` - ナビゲーションボタン
- アイコン（lucide-react）

#### BiddingList（`/biddings`）

入札情報の検索・一覧表示ページである。

**主要機能**：
- キーワード検索
- 発注機関コード検索
- 日付範囲検索
- 検索結果のテーブル表示
- ページネーション
- CSVエクスポート
- Excelエクスポート
- 詳細検索条件の表示切り替え（今後実装予定）

**使用コンポーネント**：
- `Input` - 検索フォーム
- `Table` - 検索結果表示
- `Button` - 検索・エクスポートボタン
- `Card` - レイアウト

**状態管理**：
- `keyword` - キーワード
- `orderOrganCode` - 発注機関コード
- `startDate` - 開始日
- `endDate` - 終了日
- `page` - 現在のページ番号
- `showAdvanced` - 詳細検索表示フラグ

#### ScrapingLogs（`/scraping-logs`）

スクレイピング実行履歴の表示ページである。

**主要機能**：
- 手動スクレイピング実行ボタン
- スクレイピング履歴の一覧表示
- 実行タイプ（手動/自動）の表示
- ステータス（実行中/成功/失敗）の表示
- 取得件数・新規件数の表示
- エラーメッセージの表示

**使用コンポーネント**：
- `Button` - スクレイピング実行ボタン
- `Table` - 履歴表示
- `Badge` - ステータス表示
- `Card` - レイアウト

#### KeywordSettings（`/keyword-settings`）

キーワード監視設定ページである。

**主要機能**：
- キーワードの追加
- キーワードの有効/無効切り替え
- キーワードの削除
- 登録済みキーワードの一覧表示

**使用コンポーネント**：
- `Input` - キーワード入力
- `Button` - 追加・削除ボタン
- `Switch` - 有効/無効切り替え
- `Table` - キーワード一覧
- `Card` - レイアウト

#### ScheduleSettings（`/schedule-settings`）

スケジュール設定ページである。

**主要機能**：
- 実行頻度の選択（日次/週次/月次）
- 実行時刻の設定
- スケジュールの有効/無効切り替え
- スケジュールの削除
- 登録済みスケジュールの一覧表示

**使用コンポーネント**：
- `Select` - 頻度選択
- `Input` - 時刻入力
- `Button` - 追加・削除ボタン
- `Switch` - 有効/無効切り替え
- `Table` - スケジュール一覧
- `Card` - レイアウト

### ルーティング設定

ルーティングは `client/src/App.tsx` で定義されている。

```typescript
<Switch>
  <Route path="/" component={Home} />
  <Route path="/biddings" component={BiddingList} />
  <Route path="/scraping-logs" component={ScrapingLogs} />
  <Route path="/keyword-settings" component={KeywordSettings} />
  <Route path="/schedule-settings" component={ScheduleSettings} />
  <Route path="/404" component={NotFound} />
  <Route component={NotFound} />
</Switch>
```

### 認証フロー

認証は Manus OAuth を使用している。

**ログイン**：
1. 未認証ユーザーが保護されたページにアクセス
2. `getLoginUrl()` で取得したログインURLにリダイレクト
3. Manus OAuthでログイン
4. `/api/oauth/callback` にリダイレクト
5. サーバー側でセッションCookieを発行
6. 元のページにリダイレクト

**ログアウト**：
1. `trpc.auth.logout.useMutation()` を実行
2. サーバー側でセッションCookieをクリア
3. ログインページにリダイレクト

**認証状態の取得**：
```typescript
const { user, isAuthenticated, loading } = useAuth();
```

### スタイリング

スタイリングは Tailwind CSS 4 を使用している。

**カラーパレット**は、ビジネス向けの落ち着いたブルー系を採用している。

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
```

**フォント**は、Noto Sans JPを使用している。

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

**レスポンシブデザイン**は、Tailwindのブレークポイントを使用している。

- `sm`: 640px以上
- `md`: 768px以上
- `lg`: 1024px以上
- `xl`: 1280px以上

---

## 環境構築手順

### 前提条件

以下のソフトウェアがインストールされている必要がある。

- Node.js 22.13.0以上
- pnpm 10.4.1以上
- MySQL 8.0またはTiDB
- Chromium/Chrome 128以上
- ChromeDriver 128

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd mie_bidding_system
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. 環境変数の設定

`.env` ファイルを作成し、以下の環境変数を設定する。

```env
# データベース接続情報
DATABASE_URL=mysql://user:password@localhost:3306/mie_bidding

# JWT秘密鍵
JWT_SECRET=your-secret-key-here

# Manus OAuth設定
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_OPEN_ID=your-open-id
OWNER_NAME=Your Name

# Manus組み込みAPI
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# アナリティクス（オプション）
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# アプリケーション設定
VITE_APP_TITLE=三重県入札情報取得システム
VITE_APP_LOGO=/logo.png
```

### 4. データベースのセットアップ

```bash
# マイグレーション実行
pnpm db:push
```

### 5. ChromeDriverのインストール

ChromeDriver 128をインストールし、`/usr/local/bin/chromedriver-128` に配置する。

```bash
# ChromeDriver 128のダウンロード
wget https://storage.googleapis.com/chrome-for-testing-public/128.0.6613.137/linux64/chromedriver-linux64.zip

# 解凍
unzip chromedriver-linux64.zip

# 配置
sudo mv chromedriver-linux64/chromedriver /usr/local/bin/chromedriver-128
sudo chmod +x /usr/local/bin/chromedriver-128
```

### 6. 開発サーバーの起動

```bash
pnpm dev
```

開発サーバーは `http://localhost:3000` で起動する。

### 7. テストの実行

```bash
pnpm test
```

---

## デプロイ手順

### Manusプラットフォームへのデプロイ

Manusプラットフォームを使用している場合、以下の手順でデプロイする。

#### 1. チェックポイントの作成

管理UIで「チェックポイント作成」ボタンをクリックし、現在の状態を保存する。

#### 2. 公開

管理UIのヘッダーにある「Publish（公開）」ボタンをクリックし、最新のチェックポイントを選択して公開する。

#### 3. カスタムドメインの設定（オプション）

管理UI → Settings → Domains で、カスタムドメインを設定する。

### 外部ホスティングへのデプロイ

外部ホスティングサービス（Railway、Render、Vercel等）にデプロイする場合、以下の手順を実行する。

#### 1. ビルド

```bash
pnpm build
```

ビルド成果物は以下に生成される。

- フロントエンド: `client/dist/`
- バックエンド: `dist/`

#### 2. 本番サーバーの起動

```bash
NODE_ENV=production node dist/index.js
```

#### 3. 環境変数の設定

本番環境で、開発環境と同じ環境変数を設定する。

#### 4. データベースの準備

本番環境のデータベースを準備し、マイグレーションを実行する。

```bash
pnpm db:push
```

#### 5. ChromeDriverの配置

本番サーバーにChromiumとChromeDriverをインストールする。

---

## 運用・保守

### 定期的なメンテナンス

以下のメンテナンス作業を定期的に実施することを推奨する。

**データベースのバックアップ**は、週次または日次でデータベースの完全バックアップを取得する。重要なデータは複数の場所に保存する。

**スクレイピング履歴の確認**は、週次でスクレイピング履歴を確認し、エラー率が高い場合は原因を調査する。三重県入札情報サイトの構造変更に注意する。

**依存関係の更新**は、月次でnpmパッケージの更新を確認し、セキュリティアップデートを適用する。

**ログの監視**は、エラーログを定期的に確認し、異常なパターンがないかチェックする。

### トラブルシューティング

#### スクレイピングが失敗する

**原因1**: ChromeDriverとChromiumのバージョン不一致

**解決策**: ChromeDriverのバージョンを確認し、Chromiumのバージョンと一致させる。

```bash
chromium-browser --version
/usr/local/bin/chromedriver-128 --version
```

**原因2**: 三重県入札情報サイトの構造変更

**解決策**: `server/scraper.ts` のセレクタやロジックを修正する。`MIE_BIDDING_SITE_STRUCTURE.md` を参照し、サイトの現在の構造を確認する。

**原因3**: タイムアウト

**解決策**: `server/scraper.ts` の待機時間を延長する。

```typescript
await driver.wait(until.elementLocated(By.css('table')), 15000); // 8秒 → 15秒
```

#### データベース接続エラー

**原因**: データベースサーバーが停止している、または接続情報が間違っている

**解決策**: データベースサーバーの状態を確認し、`.env` ファイルの `DATABASE_URL` を確認する。

```bash
# データベース接続テスト
mysql -h localhost -u user -p mie_bidding
```

#### 認証エラー

**原因**: Manus OAuth設定が間違っている、またはセッションCookieが期限切れ

**解決策**: `.env` ファイルの OAuth 関連の環境変数を確認する。ブラウザのCookieをクリアして再ログインする。

### パフォーマンス最適化

#### データベースインデックスの追加

頻繁に検索されるカラムにインデックスを追加する。

```sql
CREATE INDEX idx_biddings_case_number ON biddings(caseNumber);
CREATE INDEX idx_biddings_order_organ_code ON biddings(orderOrganCode);
CREATE INDEX idx_biddings_bidding_date ON biddings(biddingDate);
CREATE INDEX idx_biddings_created_at ON biddings(createdAt);
```

#### スクレイピングの並列化

複数の検索条件を並列で実行することで、処理時間を短縮できる。

```typescript
const results = await Promise.all([
  scrapeMieBiddings({ projectType: ['土木'] }, false),
  scrapeMieBiddings({ projectType: ['建築'] }, false),
  scrapeMieBiddings({ projectType: ['電気'] }, false),
]);
```

#### キャッシュの導入

検索結果をRedisなどのキャッシュに保存し、同じ検索条件の場合はキャッシュから返却する。

### セキュリティ対策

#### 環境変数の保護

`.env` ファイルは絶対にGitにコミットしない。`.gitignore` に追加されていることを確認する。

```gitignore
.env
.env.local
.env.production
```

#### SQLインジェクション対策

Drizzle ORMはプリペアドステートメントを使用しているため、基本的にSQLインジェクションのリスクは低い。ただし、生のSQLを実行する場合は注意が必要である。

#### XSS対策

Reactは自動的にエスケープ処理を行うため、基本的にXSSのリスクは低い。ただし、`dangerouslySetInnerHTML` を使用する場合は注意が必要である。

#### CSRF対策

tRPCはJSONベースのAPIであり、Cookieベースのセッション管理を使用しているため、CSRFトークンの実装を検討する。

---

## 今後の実装予定

### 定期自動実行機能

node-scheduleを使用して、設定した時刻に自動でスクレイピングを実行する機能を実装する。

```typescript
import schedule from 'node-schedule';

// 毎日午前9時に実行
schedule.scheduleJob('0 9 * * *', async () => {
  await scrapeMieBiddings({ useLatestAnnouncement: true }, false);
});
```

### 通知機能

キーワードマッチング時にメール通知やSlack通知を送信する機能を実装する。

**メール通知**:
- Gmail API または SendGrid を使用
- 新規案件がキーワードに一致した場合、登録メールアドレスに通知

**Slack通知**:
- Slack Webhook を使用
- 新規案件がキーワードに一致した場合、指定チャンネルに通知

### ダッシュボードの統計情報

取得案件数の推移グラフ、発注機関別の分布、月別の入札件数などの可視化を実装する。

- Recharts を使用したグラフ表示
- 日次・週次・月次の集計
- 発注機関別の案件数ランキング

### 個別案件の詳細情報取得

現在は一覧ページの情報のみ取得しているが、各案件の詳細ページにアクセスして追加情報を取得する機能を実装する。

- 予定価格の詳細
- 工期
- 技術提案の有無
- 添付ファイルのダウンロード

---

## まとめ

本仕様書では、三重県入札情報取得システムの完全な技術仕様を記載した。本システムは、Selenium WebDriverを使用した安定したスクレイピング機能、tRPCによる型安全なAPI、React + TypeScriptによるモダンなフロントエンドを備えている。

本仕様書に基づいて、システムの再現、拡張、保守が可能である。今後の機能追加として、定期自動実行機能、通知機能、ダッシュボードの統計情報などを実装することで、より実用的なシステムとなる。

---

**作成者**: Manus AI  
**バージョン**: 1.0  
**最終更新日**: 2026年1月18日
