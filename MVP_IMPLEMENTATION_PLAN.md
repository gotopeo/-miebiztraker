# 三重県入札情報取得システム MVP実装計画

## 実装期間
2026年1月23日〜（予定）

## MVP成功条件（再確認）
- 三重県入札サイトに掲載される案件を定期収集し、
- ユーザーが設定した条件（発注機関／種別／キーワード）に合致する **新規案件** を、
- ユーザーの指定時刻に **LINEで確実に受け取れる**。

---

## フェーズ1: データベーススキーマの拡張とマスターデータ準備

### 1.1 biddingsテーブルの拡張

**追加カラム**:
- `tender_canonical_id` (VARCHAR(255), UNIQUE, NOT NULL): 案件同一性キー
  - 優先順位: ①公告番号/案件番号 → ②詳細URL → ③発注機関+案件名+種別のハッシュ
- `last_updated_at_source` (DATETIME, NULL): サイトから取得した最終更新日
  - 現状の`updatedAt`はシステム更新日時として残す
- `first_seen_at` (DATETIME, NOT NULL): システムが初めて観測した日時
- `last_seen_at` (DATETIME, NOT NULL): システムが最後に観測した日時

**既存カラムの確認**:
- `caseNumber`: 施行番号（8桁）→ `tender_canonical_id`の候補
- `publicationDate`: 公告日（現状NULL可能性あり）
- `applicationDeadline`: 申込締切日（現状NULL可能性あり）
- `biddingDate`: 開札日（現状NULL可能性あり）

### 1.2 発注機関マスターテーブルの作成

**テーブル名**: `issuers`

**カラム**:
- `id` (INT, AUTO_INCREMENT, PRIMARY KEY)
- `name` (VARCHAR(255), NOT NULL): 発注機関名（例: 「鈴鹿建設事務所」）
- `code` (VARCHAR(50), UNIQUE): 発注機関コード（スクレイピング時の識別用）
- `category` (VARCHAR(100)): 分類（例: 「県土整備部」）
- `sort_order` (INT): 表示順序
- `is_active` (BOOLEAN, DEFAULT TRUE): 有効/無効
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**初期データ**: 提供された所属リスト（54機関）をINSERT

### 1.3 notification_subscriptionsテーブルの拡張

**追加カラム**:
- `project_type` (VARCHAR(50), NULL): 工種/委託種別（"工事", "委託", "両方"）
- `issuer_ids` (TEXT, NULL): 発注機関IDのJSON配列（例: `[1,5,12]`）
  - 現状の`issuerCode`は廃止または併用
- `is_first_notification_sent` (BOOLEAN, DEFAULT FALSE): 初回通知済みフラグ

### 1.4 notification_logsテーブルの拡張

**追加カラム**:
- `tender_canonical_id` (VARCHAR(255), NOT NULL): 通知した案件のID
- `notification_type` (ENUM('NEW', 'UPDATE'), NOT NULL): 新規/更新区分
- `sent_at` (DATETIME, NOT NULL): 送信日時
- `success` (BOOLEAN, NOT NULL): 成功/失敗
- `error_message` (TEXT, NULL): エラーメッセージ
- `message_content` (TEXT, NULL): 送信内容

**インデックス**:
- `user_id + rule_id + tender_canonical_id + notification_type` (UNIQUE): 重複防止用

---

## フェーズ2: 案件同一性判定と新規案件検出ロジックの実装

### 2.1 tender_canonical_id生成ロジック

**実装場所**: `server/db.ts`

**関数名**: `generateTenderCanonicalId(item: ScrapedBiddingItem): string`

**ロジック**:
```typescript
function generateTenderCanonicalId(item: ScrapedBiddingItem): string {
  // 優先順位1: 案件番号（caseNumber）が8桁の数字なら使用
  if (item.caseNumber && /^\d{8}$/.test(item.caseNumber)) {
    return `CN-${item.caseNumber}`;
  }
  
  // 優先順位2: 詳細URLが安定している場合
  if (item.detailUrl && item.detailUrl.includes('ankenNo=')) {
    const match = item.detailUrl.match(/ankenNo=([^&]+)/);
    if (match) {
      return `URL-${match[1]}`;
    }
  }
  
  // 優先順位3: 発注機関+案件名+種別のハッシュ（最終手段）
  const normalized = `${item.orderOrganName}|${item.title}|${item.constructionType}`
    .replace(/\s+/g, '')
    .toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  return `HASH-${hash}`;
}
```

### 2.2 新規案件判定ロジック

**実装場所**: `server/db.ts`

**関数名**: `detectNewBiddings(items: ScrapedBiddingItem[]): Promise<NewBiddingResult[]>`

**ロジック**:
1. 各アイテムの`tender_canonical_id`を生成
2. データベースで既存案件を検索（`tender_canonical_id`で照合）
3. 存在しない場合 → **新規案件**
4. 新規案件をINSERT（`first_seen_at`, `last_seen_at`を現在時刻に設定）
5. 既存案件の場合、`last_seen_at`を更新

**戻り値**:
```typescript
interface NewBiddingResult {
  tender_canonical_id: string;
  is_new: boolean;
  bidding_id: number;
}
```

---

## フェーズ3: 通知設定UIの改善（発注機関固定リスト、キーワードOR条件）

### 3.1 発注機関選択UIの実装

**実装場所**: `client/src/pages/NotificationSettings.tsx`

**変更内容**:
1. `issuerCode`（自由入力）を廃止
2. `issuer_ids`（複数選択ドロップダウン）を追加
3. shadcn/uiの`MultiSelect`コンポーネントを使用

**API**:
- `trpc.issuers.list.useQuery()`: 発注機関マスター一覧を取得

### 3.2 キーワードOR条件の実装

**現状**: キーワードはカンマ区切りで保存されているが、AND条件として扱われている可能性

**変更内容**:
1. バックエンドの`searchBiddings`関数で、キーワードを**OR条件**として検索
2. 正規化処理を追加（全角半角統一、空白統一、大小文字統一）

**実装場所**: `server/db.ts`

```typescript
// キーワードOR条件の実装例
if (keywords && keywords.length > 0) {
  const normalizedKeywords = keywords.map(k => normalizeKeyword(k));
  const keywordConditions = normalizedKeywords.map(keyword => 
    sql`LOWER(REPLACE(REPLACE(${biddings.title}, ' ', ''), '　', '')) LIKE ${`%${keyword}%`}`
  );
  conditions.push(or(...keywordConditions));
}
```

### 3.3 工種/委託種別フィルターの追加

**実装場所**: `client/src/pages/NotificationSettings.tsx`

**追加フィールド**:
- ラジオボタン: 「工事のみ」「委託のみ」「両方」

---

## フェーズ4: 初回通知抑制機能の実装（最新10件のみ）

### 4.1 初回通知判定ロジック

**実装場所**: `server/notificationJob.ts`

**ロジック**:
1. 通知設定の`is_first_notification_sent`フラグを確認
2. `false`の場合、初回通知として扱う
3. 条件に一致する案件を取得し、最新10件のみに絞る
4. 10件を1通のLINEメッセージにまとめて送信
5. 送信後、`is_first_notification_sent`を`true`に更新

**ソート基準**:
1. `publicationDate`（公告日）が存在する場合、降順
2. `publicationDate`がNULLの場合、`first_seen_at`降順

---

## フェーズ5: 通知の重複防止ロジックの実装

### 5.1 通知済みキーの生成

**実装場所**: `server/notificationJob.ts`

**関数名**: `generateNotificationKey(userId, ruleId, tenderCanonicalId, type): string`

**ロジック**:
```typescript
function generateNotificationKey(
  userId: number,
  ruleId: number,
  tenderCanonicalId: string,
  type: 'NEW' | 'UPDATE'
): string {
  return `${userId}-${ruleId}-${tenderCanonicalId}-${type}`;
}
```

### 5.2 重複チェック

**実装場所**: `server/notificationJob.ts`

**ロジック**:
1. 通知送信前に、`notification_logs`テーブルを検索
2. `user_id`, `rule_id`, `tender_canonical_id`, `notification_type`が一致するレコードが存在する場合、スキップ
3. 存在しない場合、通知を送信し、ログを記録

---

## フェーズ6: 定期スクレイピングと通知ジョブの統合

### 6.1 スクレイピングジョブの実装

**実装場所**: `server/scheduler.ts`

**スケジュール**: 10分ごと（cron: `0 */10 * * * *`）

**処理フロー**:
1. `scrapeMieBiddings({ useLatestAnnouncement: true })`を実行
2. 取得した案件を`detectNewBiddings()`で新規判定
3. 新規案件をデータベースに保存
4. スクレイピングログを記録

### 6.2 通知ジョブの実装

**実装場所**: `server/notificationJob.ts`

**スケジュール**: ユーザーの通知時刻に基づいて動的に登録

**処理フロー**:
1. 有効な通知設定を取得
2. 各設定について、条件に一致する新規案件を検索
3. 初回通知の場合、最新10件のみに絞る
4. 重複チェックを実施
5. LINE通知を送信
6. 通知ログを記録

---

## フェーズ7: テストと動作確認

### 7.1 ユニットテスト

**テスト対象**:
- `generateTenderCanonicalId()`: 案件同一性キー生成
- `detectNewBiddings()`: 新規案件判定
- `generateNotificationKey()`: 通知済みキー生成
- キーワードOR条件の検索ロジック

### 7.2 統合テスト

**テストシナリオ**:
1. スクレイピング → 新規案件検出 → 通知送信の一連の流れ
2. 初回通知（最新10件のみ）
3. 重複通知の防止
4. キーワードOR条件の動作確認

### 7.3 手動テスト

**確認項目**:
- 発注機関の固定リスト表示
- 通知設定の作成・編集・削除
- LINE通知の受信
- 通知履歴の表示

---

## フェーズ8: ユーザーへの成果物提供とドキュメント作成

### 8.1 ユーザーマニュアル作成

**内容**:
1. ログイン方法
2. LINE連携の手順
3. 通知設定の作成方法
4. 通知履歴の確認方法

### 8.2 管理者向けドキュメント

**内容**:
1. スクレイピングジョブの監視方法
2. データベースのメンテナンス
3. トラブルシューティング

### 8.3 チェックポイント作成

最終的な実装完了後、チェックポイントを作成してユーザーに提供

---

## 実装の優先順位（確定版）

### 最優先（MVP必須）
1. ✅ フェーズ1: データベーススキーマの拡張
2. ✅ フェーズ2: 案件同一性判定と新規案件検出
3. ✅ フェーズ4: 初回通知抑制（最新10件）
4. ✅ フェーズ5: 通知の重複防止
5. ✅ フェーズ6: 定期スクレイピングと通知ジョブの統合

### 高優先（UX改善）
6. ✅ フェーズ3: 発注機関固定リスト、キーワードOR条件

### 中優先（テストと品質保証）
7. ✅ フェーズ7: テストと動作確認

### 低優先（ドキュメント）
8. ✅ フェーズ8: ドキュメント作成

---

## 次のアクション

このMVP実装計画に基づいて、フェーズ1から順次実装を開始します。
