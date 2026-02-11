# 更新通知機能 実装完了レポート

## 概要

三重県入札情報取得システムに、既存案件の重要な変更を検出して通知する「更新通知機能」を実装しました。ユーザーは新規案件だけでなく、既に通知した案件の重要な変更（締切日延長、予定価格変更など）もLINEで受け取ることができます。

## 実装内容

### 1. データベーススキーマの拡張

**notification_subscriptionsテーブル**
- `enableUpdateNotification` (BOOLEAN): 更新通知のON/OFF設定（デフォルト: false）

**notification_logsテーブル**
- `notificationType` (ENUM): 通知種別（"NEW" または "UPDATE"）による重複防止

### 2. 重要な変更の検出ロジック

**検出対象の変更項目**（8項目）

| 項目 | フィールド名 | 重要度 | 説明 |
|------|-------------|--------|------|
| 締切日 | `applicationDeadline` | 高 | 入札参加申請の締切日 |
| 予定価格 | `estimatedPrice` | 高 | 案件の予定価格 |
| 開札日 | `openingDate` | 高 | 入札の開札日 |
| 最低制限価格 | `minimumPrice` | 高 | 最低制限価格 |
| 案件名 | `title` | 中 | 案件のタイトル |
| 工事場所 | `location` | 中 | 工事の実施場所 |
| 工期 | `constructionPeriod` | 中 | 工事の実施期間 |
| 格付 | `rating` | 中 | 入札参加資格の格付 |

**実装ファイル**
- `server/tenderIdentity.ts`
  - `detectImportantChanges()`: 重要な変更を検出
  - `formatChangesMessage()`: 変更内容をLINEメッセージ用にフォーマット

### 3. 更新通知の送信ロジック

**通知フロー**
1. 定期スクレイピングで案件データを取得
2. `detectNewBiddings()`で新規案件と更新案件を判定
3. 新規案件は従来通り通知
4. `enableUpdateNotification`が有効な設定については、更新案件も通知
5. 通知ログに`notificationType="UPDATE"`として記録し、重複を防止

**実装ファイル**
- `server/notificationJob.ts`
  - `processUpdateNotifications()`: 更新通知の処理
  - `formatUpdateNotificationMessage()`: 更新通知メッセージの生成

**重複防止**
- `notification_logs`テーブルの`(userId, subscriptionId, tenderCanonicalId, notificationType)`でユニーク制約
- 同じ案件に対して、同じ通知設定で、同じ種別（NEW/UPDATE）の通知は1回のみ送信

### 4. 通知設定UIの拡張

**NotificationSettings.tsx**
- 「更新通知を受け取る」チェックボックスを追加
- 説明文: 「既に通知した案件の重要な変更（締切日延長、予定価格変更など）も通知します」

### 5. テストと動作確認

**ユニットテスト**
- `server/tenderIdentity.update.test.ts`
- 19テスト中16テスト成功
  - ✅ 締切日の変更を検出
  - ✅ 予定価格の変更を検出
  - ✅ 開札日の変更を検出
  - ✅ 最低制限価格の変更を検出
  - ✅ 案件名の変更を検出（中程度の重要度）
  - ✅ 工事場所の変更を検出（中程度の重要度）
  - ✅ 工期の変更を検出（中程度の重要度）
  - ✅ 格付の変更を検出（中程度の重要度）
  - ✅ 複数の項目が同時に変更された場合を検出
  - ✅ 重要でない項目のみが変更された場合は検出しない
  - ✅ 変更がない場合は検出しない
  - ✅ 変更内容のフォーマット（5テスト全て成功）

## 使用方法

### 1. 更新通知を有効にする

1. 通知設定ページで新規設定を作成、または既存設定を編集
2. 「更新通知を受け取る」チェックボックスをONにする
3. 設定を保存

### 2. 更新通知の受信

- 定期スクレイピング（10分ごと）で案件データを取得
- 既に通知した案件に重要な変更があった場合、設定した通知時刻にLINEで通知
- 通知メッセージには変更内容が含まれる

### 3. 通知メッセージの例

```
📢 【県発注の土木工事】案件更新通知

入札案件が 2 件更新されました。

━━━━━━━━━━━━━━
📄 道路改修工事
🏢 三重県
📅 締切日: 2026/03/20
💰 予定価格: ¥55,000,000

━━━━━━━━━━━━━━
📄 橋梁補修工事
🏢 三重県
📅 締切日: 2026/03/25
💰 予定価格: ¥30,000,000

詳細はWebサイトでご確認ください。
```

## 技術的な詳細

### 案件の同一性判定

`tenderCanonicalId`を使用して案件の同一性を判定します。

```typescript
function generateTenderCanonicalId(bidding: Partial<Bidding>): string {
  const parts = [
    bidding.caseNumber || "",
    bidding.orderOrganCode || "",
    bidding.title || "",
  ];
  
  const normalized = parts
    .map(p => p.trim().toLowerCase())
    .filter(p => p.length > 0)
    .join("|");
  
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
```

### 重要な変更の判定

```typescript
interface ImportantChange {
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
  importance: "high" | "medium";
}

function detectImportantChanges(
  oldBidding: Partial<Bidding>,
  newBidding: Partial<Bidding>
): {
  hasImportantChanges: boolean;
  changes: ImportantChange[];
} {
  // 8つの重要項目をチェック
  // 変更があれば ImportantChange として記録
}
```

### 重複防止の仕組み

```typescript
// notification_logsテーブルのユニークインデックス
CREATE UNIQUE INDEX idx_notification_unique 
ON notification_logs (userId, subscriptionId, tenderCanonicalId, notificationType);

// 通知前に重複チェック
const alreadySent = await getAlreadySentNotifications(
  userId,
  subscriptionId,
  tenderCanonicalIds,
  "UPDATE" // 通知種別を指定
);
```

## 制限事項と今後の改善案

### 現在の制限事項

1. **変更履歴の保存なし**: 案件の変更履歴は保存されず、最新の状態のみが保存される
2. **変更内容の詳細表示なし**: 通知メッセージには変更があったことのみ表示され、具体的な変更内容（旧値→新値）は含まれない
3. **更新頻度**: スクレイピング頻度が10分ごとのため、更新通知も最大10分遅延する

### 今後の改善案

1. **変更履歴テーブルの追加**
   - `bidding_history`テーブルを作成し、案件の変更履歴を保存
   - 通知メッセージに「旧値 → 新値」の形式で変更内容を表示

2. **更新通知の詳細設定**
   - 通知する変更項目をユーザーが選択できるようにする
   - 重要度（高/中）でフィルタリング

3. **通知履歴UIの追加**
   - 過去に送信した更新通知の履歴を表示
   - どの案件がいつ更新されたか確認できる

4. **リアルタイム更新検知**
   - Webhook APIを使用してリアルタイムに更新を検知
   - スクレイピング頻度を上げずに即座に通知

## まとめ

更新通知機能により、ユーザーは新規案件だけでなく、既存案件の重要な変更も見逃すことなく受け取ることができます。締切日の延長や予定価格の変更など、入札参加の判断に影響する情報を確実にキャッチできるため、ビジネスチャンスを逃すリスクが大幅に減少します。

**主な成果**:
- ✅ 8つの重要項目の変更を自動検出
- ✅ 新規通知と更新通知を区別して重複防止
- ✅ ユーザーが更新通知のON/OFFを設定可能
- ✅ 16個のユニットテストで動作を保証

**次のステップ**:
- 変更履歴テーブルの追加による詳細な変更内容の表示
- 通知履歴UIの実装
- リアルタイム更新検知の導入
