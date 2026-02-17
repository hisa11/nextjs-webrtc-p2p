# P2P Chat App - 認証機能追加版

## 🎉 新機能

### ✅ 実装完了

1. **ユーザー認証**
   - GitHub / Google OAuth ログイン
   - NextAuth.js v5統合
   - セッション管理

2. **連絡先管理**
   - 連絡先の追加・削除
   - 連絡先リストの表示
   - Vercel KVに保存

3. **マルチチャット**
   - 複数の相手とチャット可能
   - チャット履歴の管理
   - 連絡先切り替え

4. **ユーザーデータ永続化**
   - ユーザーIDと連絡先をVercel KVに保存
   - 認証されたユーザーのみアクセス可能

## 🚀 セットアップ手順

### 1. GitHub OAuth アプリを作成

1. https://github.com/settings/developers にアクセス
2. "New OAuth App"をクリック
3. 以下を入力:
   - Application name: `P2P Chat App`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. "Register application"をクリック
5. Client IDとClient secretをコピーして`.env.local`に設定

### 2. Google OAuth アプリを作成（オプション）

1. https://console.cloud.google.com/ にアクセス
2. 新しいプロジェクトを作成
3. "APIs & Services" > "Credentials"
4. "Create Credentials" > "OAuth client ID"
5. Application type: "Web application"
6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Client IDとClient secretをコピーして`.env.local`に設定

### 3. 環境変数を設定

`.env.local`ファイルを編集:

```bash
# すでに設定済み
AUTH_SECRET="pCLx23d74FVnxT5ln9qMiMhEHxXUtfhGKnoEcj+bT/Y="
NEXTAUTH_URL="http://localhost:3000"

# GitHub OAuth（ステップ1で取得）
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Google OAuth（ステップ2で取得・オプション）
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

### 4. 開発サーバーを起動

```bash
npm run dev
```

http://localhost:3000 を開きます

## 📖 使い方

### 1. サインイン
- GitHub または Google アカウントでサインイン

### 2. 連絡先を追加
- 「+ 連絡先を追加」ボタンをクリック
- 相手のユーザーIDを入力（相手もサインイン済みである必要があります）
- 名前を入力（オプション）
- 「追加」をクリック

### 3. チャット開始
- 左のリストから連絡先を選択
- 自動的にP2P接続が開始されます
- メッセージを入力して送信

### 4. 連絡先の切り替え
- 左のリストから別の連絡先をクリック
- チャット画面が切り替わります
- 各連絡先のチャット履歴は保持されます

## 🔐 セキュリティ

- 認証されたユーザーのみアクセス可能
- 連絡先データはユーザーIDごとに分離
- P2P通信で直接データ送信
- セッションベースの認証

## 📁 新しいファイル構成

```
nextjs-webrtc-p2p/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth.js エンドポイント
│   │   └── contacts/route.ts            # 連絡先API
│   ├── chat/page.tsx                     # メインチャットページ
│   └── page.tsx                          # リダイレクト
├── auth.ts                               # NextAuth.js設定
├── middleware.ts                         # 認証ミドルウェア
├── types/next-auth.d.ts                  # TypeScript型定義
└── .env.local                            # 環境変数
```

## 🎯 本番環境デプロイ

### Vercel環境変数の設定

1. Vercel Dashboardでプロジェクトを開く
2. Settings > Environment Variables
3. 以下を追加:
   - `AUTH_SECRET`
   - `AUTH_GITHUB_ID`
   - `AUTH_GITHUB_SECRET`
   - `AUTH_GOOGLE_ID`（オプション）
   - `AUTH_GOOGLE_SECRET`（オプション）

### OAuth リダイレクトURLの更新

本番環境のURLに変更:
- GitHub: `https://your-app.vercel.app/api/auth/callback/github`
- Google: `https://your-app.vercel.app/api/auth/callback/google`

## ✨ 機能一覧

| 機能 | 説明 | 状態 |
|------|------|------|
| ユーザー認証 | GitHub/Google OAuth | ✅ |
| 連絡先管理 | 追加・削除・表示 | ✅ |
| マルチチャット | 複数の相手とチャット | ✅ |
| P2P接続 | WebRTC直接通信 | ✅ |
| オフラインメッセージ | 自動保存・配信 | ✅ |
| データ永続化 | Vercel KV保存 | ✅ |
| セッション管理 | 自動ログイン維持 | ✅ |

## 🐛 トラブルシューティング

### ログインできない
- OAuth認証情報が正しく設定されているか確認
- リダイレクトURLが正しいか確認
- `.env.local`を再読み込み（サーバー再起動）

### 連絡先が表示されない
- ログインしているか確認
- Vercel KVが正しく接続されているか確認

### P2P接続ができない
- 両方のユーザーがログインしているか確認
- 相手のユーザーIDが正しいか確認
- ブラウザコンソールでエラーを確認

---

🎉 これで複数の相手とチャットできる、認証付きP2Pチャットアプリが完成しました！
