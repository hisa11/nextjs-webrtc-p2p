# Vercel デプロイ手順

## 前提条件

- Vercelアカウント（無料プラン可）
- GitHubリポジトリ

## 手順

### 1. GitHubにプッシュ

```bash
git init
git add .
git commit -m "Initial commit: WebRTC P2P chat app"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Vercelにデプロイ

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. "Import Project"をクリック
3. GitHubリポジトリを選択
4. プロジェクト設定:
   - Framework Preset: **Next.js**
   - Root Directory: `./` (デフォルト)
   - Build Command: `npm run build` (デフォルト)
   - Output Directory: `.next` (デフォルト)
5. "Deploy"をクリック

### 3. Vercel KVデータベースの作成

1. Vercel Dashboardでプロジェクトを開く
2. 上部メニューから"Storage"をクリック
3. "Create Database"をクリック
4. "KV"を選択
5. データベース名を入力（例: `webrtc-signaling`）
6. リージョンを選択（推奨: ユーザーに近いリージョン）
7. "Create"をクリック

### 4. KVデータベースをプロジェクトにリンク

1. 作成したKVデータベースを開く
2. "Connect Project"をクリック
3. プロジェクトを選択
4. "Connect"をクリック

環境変数が自動的に設定されます:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

### 5. 再デプロイ（必要な場合）

環境変数が反映されない場合、手動で再デプロイ:

1. Deploymentsタブを開く
2. 最新のデプロイの"..."メニューをクリック
3. "Redeploy"を選択

## ローカル開発

### Vercel環境変数の取得

```bash
# Vercel CLIをインストール
npm i -g vercel

# プロジェクトにリンク
vercel link

# 環境変数をダウンロード
vercel env pull .env.local
```

### 開発サーバー起動

```bash
npm run dev
```

## 動作確認

1. デプロイされたURLを開く（例: `https://your-app.vercel.app`）
2. 自分のIDが表示されることを確認
3. 別のブラウザ/タブで同じURLを開く
4. それぞれのIDをコピーして相手のIDとして入力
5. "接続開始"をクリック
6. 接続が確立されることを確認
7. メッセージを送信してP2P通信を確認

## トラブルシューティング

### KV接続エラー

環境変数が正しく設定されているか確認:

```bash
vercel env ls
```

### デプロイエラー

ビルドログを確認:

1. Deploymentsタブ
2. 失敗したデプロイをクリック
3. "Build Logs"を確認

### 関数タイムアウト

無料プランは10秒制限があります。コードで`maxDuration = 10`が設定されていることを確認。

## Vercel無料プランの制限

- **関数実行時間**: 10秒
- **KV容量**: 256 MB
- **KVリクエスト**: 月3000回まで無料、それ以降は従量課金
- **帯域幅**: 100 GB/月

### 制限を超えないために

1. **効率的なポーリング**:
   - 2秒間隔（頻繁すぎない）
   - 接続確立後はポーリング停止を検討

2. **データの自動削除**:
   - シグナルデータ: 5分
   - メッセージ: 24時間
   - 通知: 24時間

3. **P2P通信の活用**:
   - チャットメッセージは直接送信
   - サーバーはシグナリングのみ

## セキュリティ設定（推奨）

### CORS設定（必要に応じて）

`next.config.ts`に追加:

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "https://your-domain.com",
          },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        ],
      },
    ];
  },
};
```

### 環境変数の確認

本番環境の環境変数は決してコミットしないこと:

- `.env.local`は`.gitignore`に含まれています
- Vercel Dashboardで管理

## モニタリング

Vercel Dashboardで以下を確認:

1. **Analytics**: トラフィック、パフォーマンス
2. **Logs**: 関数実行ログ、エラーログ
3. **Speed Insights**: ページ速度
4. **Web Vitals**: ユーザー体験指標

## アップデート

コードを更新してプッシュすると自動デプロイ:

```bash
git add .
git commit -m "Update feature"
git push
```

Vercelが自動的にビルドして本番環境にデプロイします。
