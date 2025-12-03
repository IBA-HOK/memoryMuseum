# 思い出美術館

Node.js/Express + SQLite (Prisma) で構築した個人用ドローイングアプリです。「じっくり / サクッと」モードを選択し、キャンバス形状と 5 色パレットを決めてお絵描きできます。完成した作品はサーバーに保存され、展示室 (ギャラリー) でフラットに閲覧できます。セッションは署名付き Cookie を用いた簡易的なものを採用しています。
## セットアップ手順

1. **依存パッケージのインストール**
   ```powershell
   cd c:\Users\ibaho\OneDrive\ドキュメント\github\memoryMuseum
   cmd /c npm install
   ```
2. **環境変数の設定** – `.env` を編集し、以下を設定します。
   ```dotenv
   DATABASE_URL="file:./dev.db"
   SESSION_SECRET="change-me"
   PORT=3000
   ```
3. **SQLite スキーマの生成** – スキーマ変更を反映する際に実行します。
   ```powershell
   cmd /c npm run prisma:migrate
   ```
4. **サーバーの起動**
   ```powershell
   cmd /c npm run dev
   ```
   既定では `http://localhost:3000` で API とフロントエンドが待ち受けます。

## 画面フロー

1. **GET /** – タイトル画面。「TAP TO START」でホームへ。
2. **GET /home** – ホームメニュー。展示室とアトリエへの動線。
3. **GET /atelier/mode** – 「じっくり / サクッと」モード選択。ここで制作フローが初期化されます。
4. **GET /atelier/canvas** – キャンバス形状（円 / 四角）を選択。
5. **GET /atelier/palette** – 5 色パレットを選択。サクッとモードでは自動提案された 5 色が適用されます。
6. **GET /atelier/draw** – Canvas API を用いたお絵描き画面。パレットから色を選び、保存で `/api/save` に投稿。
7. **POST /api/save** – 画像をファイル保存し、`art` レコードを作成。`gallery.artids` JSON を更新。
8. **GET /atelier/complete** – 完成通知画面。最新の作品をサムネイル表示。
9. **GET /gallery** – 展示室。保存済み画像をフラットに一覧表示。

## 主要 API

- `POST /api/save` – フロントエンドから送られた Base64 PNG を保存。`art` テーブルにレコード追加後、対応する `gallery.artids` JSON 配列に ID を追記します。
- `GET /api/gallery` – 現在のユーザーがもつギャラリーの作品一覧を返します。
- `POST /api/upload` – 既存のマルチパートアップロード API（他アプリ連携向け）。
- `POST /api/register` / `POST /api/login` / `POST /api/logout` / `GET /api/session` – 認証関連。未ログイン状態でも初回アクセス時にゲストユーザーが自動生成されるため、アプリ利用にアカウントは必須ではありません。
- `/api/arts`, `/api/galleries`, `/api/options`, `/api/authinfos`, `/api/users` – 管理・デバッグ向け CRUD エンドポイント。すべて認証必須です。

変更系エンドポイントは JSON を受信・返却します（ファイルアップロードは `multipart/form-data`）。保護されたルートに未認証でアクセスした場合、サーバー側でゲストセッションを払い出すか、適切な HTTP ステータスを返します。

## 開発メモ

- Prisma スキーマは `art`・`gallery`・`option` の `timestamp` を `BigInt` で保持します。`gallery.artids` は文字列化した JSON 配列（例: `"[1,2,3]"`）。
- セッションはメモリ上の Map で管理しており、サーバー再起動で破棄されます。必要に応じて永続化ミドルウェアへ差し替えてください。
- `uploads/` フォルダーはアプリ起動時に自動で作成され、`.gitignore` 済みです。
- Prisma スキーマを変更した際は `cmd /c npm run prisma:generate` でクライアントを再生成し、`cmd /c npm run prisma:migrate` でマイグレーションを反映してください。
- フロントエンドは EJS + Vanilla JS で構成されており、`public/js/` に Canvas 描画やパレット選択ロジックをまとめています。
