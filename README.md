# gas-sim-news-fetcher
格安SIM関連の最新ニュースを取得するGASアプリ

## ローカル開発の手順

このプロジェクトは `clasp` (Command Line Apps Script Projects) を使用してローカルで管理されています。

### 1. 初回セットアップ
Google Apps Script API を [Google Apps Script Settings](https://script.google.com/home/usersettings) で「オン」にする必要があります。

```bash
# 依存関係のインストール
npm install

# Google アカウントへのログイン
npx clasp login

# GAS プロジェクトのクローン (未実施の場合)
npx clasp clone <script-id>
```

### 2. ローカルの変更を GAS に反映 (Push)
ローカルでコードを編集した後、以下のコマンドでリモートの GAS エディタに反映させます。

```bash
npx clasp push
```

### 3. GAS エディタ側の変更をローカルに反映 (Pull)
GAS エディタで直接修正を行った場合、以下のコマンドでローカルに同期させます。

```bash
npx clasp pull
```

### 4. GAS エディタをブラウザで開く
```bash
npx clasp open
```

## 注意事項
- `.clasp.json` はプロジェクト設定を含むため、Git 管理から除外（`.gitignore`）しています。
- `.js` ファイルとしてローカル保存されますが、`clasp push` 時に自動的に `.gs` ファイルとして GAS に送信されます。
