# memoryMuseum

memoryMuseum は、Node.js/Express をベースにした SQLite + Prisma バックエンド付きの画像保管アプリです。ユーザー登録・ログイン・画像アップロード・ギャラリー閲覧をブラウザから行えます。セッションは署名付き HTTP-only Cookie で管理され、画像ファイルはディスク上 (`uploads/`) に保存され、メタデータは `art` テーブルに格納されます。

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

## API 概要

- `POST /api/register` – `{ "username": "alice", "password": "secret" }` 形式でユーザーを作成し、`authinfo` / `option` / `gallery` / `user` テーブルに関連レコードを生成、セッションクッキーを返します。
- `POST /api/login` – 既存ユーザーの認証を行い、セッションを更新します。
- `POST /api/logout` – 現在のセッションを無効化します。
- `GET /api/session` – 認証済みユーザーを返します。
- `POST /api/upload` – `multipart/form-data` (`image` フィールド) で画像をアップロードし、`art` レコードに保存。アップロードした画像IDをログイン中ユーザーの `gallery.artids` に追記します。
- `GET /api/gallery` – ログイン中ユーザーが紐づく `art` レコードを一覧で取得します。
- `GET /uploads/:file` – `art.path` に記録された URL で画像ファイルを配信します。

### テーブル CRUD エンドポイント（認証必須）

- `/api/arts` – `GET` 一覧、`POST` 新規作成（`path` 必須。`timestamp`/`creatorid` 任意）、`PUT /:artid` 更新、`DELETE /:artid` 削除。
- `/api/galleries` – `artids`（JSON 文字列または配列）と BigInt `timestamp` を扱うギャラリー管理。
- `/api/options` – BigInt `timestamp` を持つオプション行を CRUD。
- `/api/authinfos` – `authinfo` レコードの CRUD。パスワード平文 (`password`) もしくはハッシュ済み文字列 (`hashedpass`) を受け付けます。
- `/api/users` – `gallery` / `option` / `authinfo` への外部キーを設定した `user` 行の CRUD。

変更系エンドポイントは、ファイルアップロードを除き JSON を受信・返却します。保護されたルートに未認証でアクセスすると HTTP 401 を返します。

## 開発メモ

- Prisma スキーマは要件に従い、`gallery.artids` は `"[1,2,3]"` のような JSON 文字列で保存します。
- セッションは署名付き `session_id` Cookie をメモリ上で管理しています。サーバー再起動でセッションはリセットされます。
- `uploads/` フォルダーは起動時に自動生成され、Git 管理対象外です。
- Prisma スキーマを変更した際は `cmd /c npm run prisma:generate` を実行してクライアントを再生成してください。
