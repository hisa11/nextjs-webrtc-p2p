# NAT超えP2Pチャットアプリ

Vercelを使ったWebRTC P2Pチャットアプリケーション。NAT超えに対応し、相手がオフラインの時もメッセージを保存できます。

## 🌟 主な機能

- **WebRTC P2P通信**: 直接ピア同士で通信（NAT超え対応）
- **NextAuth.js認証**: GitHub/Google OAuth による安全なログイン
- **QRコードID交換**: QRコードで簡単に連絡先を追加
- **連絡先リクエスト**: 相手が承認すると連絡先に追加
- **マルチチャット**: 複数の相手とチャット切り替え
- **自動シグナリング**: Vercel KVを使った自動的な接続確立
- **オフラインメッセージ**: 相手がオフライン時もメッセージを保存し、オンライン時に配信
- **リアルタイム接続状態**: 接続状態をリアルタイムで表示
- **Vercel無料プラン最適化**: 10秒以内の関数実行、効率的なKV使用

## 🚀 セットアップ

### 1. プロジェクトのクローン

```bash
git clone <your-repo>
cd nextjs-webrtc-p2p
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Vercel KVの設定

Vercelダッシュボードで以下を実行:

1. プロジェクトを作成
2. Storage > Vercel KV > Create Database
3. プロジェクトにKVデータベースをリンク

ローカル開発用:

```bash
vercel link
vercel env pull .env.local
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 を開きます

## 📦 技術スタック

- **Next.js 16**: React フレームワーク
- **TypeScript**: 型安全性
- **Tailwind CSS**: スタイリング
- **NextAuth.js**: OAuth認証（GitHub/Google）
- **WebRTC**: P2P通信
- **QRコード**: qrcode.react（生成）、html5-qrcode（読み取り）
- **Vercel KV**: シグナリング、メッセージ保存、連絡先管理
- **Vercel**: ホスティング

## 🔧 アーキテクチャ

### 認証システム

- `/api/auth/[...nextauth]`: NextAuth.js OAuth認証エンドポイント
- GitHub/Google プロバイダー対応
- ミドルウェアで `/chat` ルートを保護

### シグナリングサーバー

- `/api/signaling`: WebRTCのSDP/ICE candidateの交換
- ポーリング方式（2秒間隔）でVercel無料プランに最適化

### 連絡先管理

- `/api/contacts`: 連絡先の追加・削除・一覧取得
- `/api/contact-requests`: QRコード経由の連絡先リクエスト処理
- リクエスト承認/拒否フロー

### メッセージ管理

- `/api/messages`: オフラインメッセージの保存・取得
- 自動削除（24時間）でKV容量を節約

### ピア管理

- `/api/peers`: ピアのオンライン状態確認
- ハートビート（30秒）で状態管理

### 通知システム

- `/api/notifications`: 未読通知の管理
- 連絡先リクエスト通知（5秒間隔でポーリング）

## 🎯 使い方

### QRコードで連絡先追加（推奨）

1. **チャット画面を開く**: GitHub/Googleでログイン
2. **QRコードボタンをクリック**: 左サイドバーの「📷 QRコード」ボタン
3. **QRコードを表示または読み取り**:
   - **表示**: 自分のQRコードを相手に見せる
   - **読み取り**: 相手のQRコードをカメラでスキャン
4. **リクエスト承認**: 相手に通知が届き、承認すると連絡先に追加
5. **チャット開始**: 連絡先リストから選択してチャット

### 手動でID入力

1. **手動追加ボタン**: 左サイドバーの「+ 手動追加」ボタン
2. **相手のIDを入力**: ユーザーIDを入力して追加
3. **チャット開始**: 連絡先リストから選択

## ⚡ Vercel無料プランの制限対応

### 実装済みの最適化

1. **関数実行時間**:
   - `maxDuration = 10`で10秒制限に対応
   - ポーリング方式でWebSocketの代替

2. **KV容量節約**:
   - シグナルデータ: 5分で自動削除
   - メッセージ: 24時間で自動削除
   - 効率的なキー設計

3. **帯域幅最適化**:
   - P2P通信でサーバー負荷最小化
   - 必要最小限のポーリング（2秒間隔）

4. **同時実行制限**:
   - 軽量なAPI設計
   - KVを使った非同期処理

## 🔒 セキュリティ

- P2P接続で直接通信（サーバーを経由しない）
- シグナリングデータの自動削除
- 一時的なデータ保存のみ

## 📝 今後の拡張

- [ ] Web Push API通知
- [ ] エンドツーエンド暗号化
- [ ] ファイル送信機能
- [ ] グループチャット
- [ ] メッセージ履歴の永続化

## 🐛 トラブルシューティング

### 接続できない場合

1. STUNサーバーの確認
2. ブラウザのWebRTC対応確認
3. Vercel KVの接続確認

### メッセージが届かない場合

1. オンライン状態の確認
2. ブラウザコンソールでエラー確認
3. Vercel関数ログの確認

## 📄 ライセンス

MIT

## 🤝 貢献

プルリクエストを歓迎します！

## 📮 サポート

問題が発生した場合は、Issueを作成してください。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
