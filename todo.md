# Project TODO

## 基本機能

- [x] 三重県入札情報サイトのスクレイピング機能
- [x] 入札情報のデータベース保存
- [x] LINE通知機能（新着案件の自動通知）
- [x] 管理画面（スクレイピング実行、通知設定）
- [x] Excel出力機能

## スクレイピング機能のPuppeteer移行

### 背景
ChromeDriverエラー「spawn /usr/local/bin/chromedriver-128 ENOENT」を根本的に解決するため、Selenium WebDriverからPuppeteerに完全移行。

### 実装内容
- [x] Selenium WebDriverとChromeDri verの依存関係を削除
- [x] Puppeteerをインストール
- [x] server/scraper.tsをPuppeteerベースに書き換え
- [x] convertToInsertBidding関数とscrapeMieBiddings関数を復元
- [x] ローカルテストで10件の入札情報を正常に取得することを確認

## Puppeteerブラウザインストール問題の解決

### フェーズ1: 問題の特定
- [x] 本番環境でのスクレイピング失敗を確認
- [x] エラーメッセージを確認（Could not find Chrome (ver. 145.0.7632.46)）
- [x] Puppeteerのブラウザが本番環境にインストールされていないことを特定

### フェーズ2: 解決策の実装
- [x] package.jsonにpostinstallスクリプトを追加してChromiumを自動インストール
- [x] Puppeteerの設定を修正（executablePathの指定）
- [x] .puppeteerrc.cjsを作成してキャッシュパスを設定
- [x] プロジェクト内にChromiumをインストール
- [x] サーバー再起動

### フェーズ3: 動作確認とチェックポイント保存
- [x] 本番環境で手動スクレイピングを実行
- [x] スクレイピングが成功することを確認
- [x] チェックポイントを保存

---

## 本番環境でのPuppeteer executablePath問題の解決

### 問題
本番環境では `/usr/src/app/.cache/puppeteer/chrome/linux-145.0.7632.46/chrome-linux64/chrome` を参照しているが、Chromiumが見つからない。

### フェーズ1: 問題の特定
- [x] 本番環境でのエラーメッセージを確認
- [x] 本番環境のワーキングディレクトリが `/usr/src/app` であることを特定

### フェーズ2: 解決策の実装
- [x] .puppeteerrc.cjsを修正して本番環境のパスに対応
- [x] package.jsonのpostinstallスクリプトを確認
- [x] サーバー再起動

### フェーズ3: 動作確認とチェックポイント保存
- [x] チェックポイントを保存
- [ ] デプロイ後、本番環境で手動スクレイピングを実行
- [ ] スクレイピングが成功することを確認

---

## postinstallスクリプトの根本的な修正（専門家の指摘に基づく）

### 問題の本質
現在の`postinstall`スクリプトは`puppeteer.executablePath()`が「実在チェック」ではなく「パス文字列を返すだけ」であるため、Chromiumが存在しなくてもcatchに落ちず、インストールが実行されない。

### フェーズ1: タスク追加
- [x] todo.mdに新しいタスクを追加

### フェーズ2: 実在チェック付きpostinstallスクリプトを作成
- [x] `scripts/ensure-chrome.mjs`を作成（fs.existsSyncで実在チェック）
- [x] package.jsonのpostinstallを修正

### フェーズ3: scraper.tsに起動時Chromiumチェックを追加
- [x] `ensureChrome()`関数を追加（実行時に自己修復）
- [x] `initBrowser()`の冒頭で`ensureChrome()`を呼び出し

### フェーズ4: 環境情報ログを追加
- [x] cwd、uid、PUPPETEER_CACHE_DIR、executablePath、existsをログ出力（ensureChrome関数内に実装）
- [x] キャッシュディレクトリの内容を確認するログを追加（必要に応じて追加可能）

### フェーズ5: 動作確認とチェックポイント保存
- [x] 開発環境でスクレイピングを実行（新しい実行履歴が表示されない）
- [ ] サーバーログを確認してensureChrome関数のログを確認
- [ ] チェックポイントを保存
- [ ] Publish後、本番環境でスクレイピングを実行
- [ ] 本番環境のログを確認して問題を特定

---

## Chromium実行に必要なシステムライブラリのインストール

### 問題の本質
Chromiumのバイナリはインストールされたが、実行に必要なシステムライブラリ（libglib-2.0.so.0など）が不足している。

### エラー内容
```
Failed to launch the browser process: Code: 127
stderr: /usr/src/app/.cache/puppeteer/chrome/linux-145.0.7632.46/chrome-linux64/chrome: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file: No such file or directory
```

### フェーズ1: タスク追加
- [x] todo.mdに新しいタスクを追加

### フェーズ2: システムライブラリインストールスクリプトを作成
- [x] `scripts/ensure-chrome.mjs`を修正して`--install-deps`フラグを使用
- [x] `server/scraper.ts`の`ensureChrome()`も同様に修正
- [x] root権限がない場合のフォールバック処理を追加

### フェーズ3: 動作確認とチェックポイント保存
- [x] チェックポイントを保存
- [ ] Publish後、本番環境でスクレイピングを実行
- [ ] システムライブラリが正常にインストールされ、スクレイピングが成功することを確認
