# 🚀 WebRTC P2Pチャットアプリ - 完成！

Vercelを使ったNAT超えP2Pチャットアプリケーションが完成しました。

## ✅ 実装された機能

### 1. **Vercelシグナリングサーバー** (/app/api/signaling/route.ts)
- WebRTC SDP/ICE candidateの交換
- Vercel KVを使った一時保存（5分で自動削除）
- ポーリング方式（2秒間隔）でVercel無料プランに最適化
- オンライン状態の自動トラッキング

### 2. **オフラインメッセージ保存** (/app/api/messages/route.ts)
- 相手がオフライン時のメッセージ自動保存
- オンライン復帰時の自動配信
- 24時間で自動削除（KV容量節約）

### 3. **ピア管理** (/app/api/peers/route.ts)
- オンライン状態の確認
- 最終接続時刻の記録
- ハートビート機能（30秒）

### 4. **通知システム** (/app/api/notifications/route.ts)
- 未読メッセージの通知フラグ
- Web Push API拡張可能な設計

### 5. **WebRTCカスタムフック** (/hooks/useWebRTC.ts)
- P2P接続の自動確立
- データチャンネル管理
- 接続状態の監視
- 自動再接続ロジック

### 6. **モダンなUI** (/app/page.tsx)
- ユーザーIDベースの接続
- リアルタイム接続状態表示
- メッセージ送信状態インジケーター
- オフライン時の自動メッセージ保存
- レスポンシブデザイン

## 🎯 Vercel無料プランの制限対応

### 実装済みの最適化：

1. **関数実行時間制限（10秒）**
   - 全API RouteでmaxDuration = 10を設定
   - ポーリング方式（WebSocketの代替）

2. **KV容量節約**
   - シグナルデータ: 5分で自動削除
   - メッセージ: 24時間で自動削除
   - 通知: 24時間で自動削除

3. **帯域幅最適化**
   - P2P通信でサーバー負荷最小化
   - 効率的なポーリング（2秒間隔）

4. **同時実行制限**
   - 軽量なAPI設計
   - 非同期処理の活用

## 📂 プロジェクト構造

```
nextjs-webrtc-p2p/
├── app/
│   ├── api/
│   │   ├── signaling/route.ts    # シグナリングサーバー
│   │   ├── messages/route.ts     # オフラインメッセージ
│   │   ├── peers/route.ts        # ピア管理
│   │   └── notifications/route.ts # 通知システム
│   ├── page.tsx                   # メインUIコンポーネント
│   ├── layout.tsx                 # レイアウト
│   └── globals.css                # スタイル
├── hooks/
│   └── useWebRTC.ts              # WebRTC接続フック
├── .env.example                   # 環境変数のサンプル
├── vercel.json                    # Vercel設定
├── README.md                      # プロジェクトドキュメント
├── DEPLOY.md                      # デプロイ手順
└── package.json                   # 依存関係
```

## 🚀 セットアップと起動

### ローカル開発：

```bash
# 依存関係のインストール
npm install

# Vercel環境変数の取得（Vercel CLIが必要）
vercel link
vercel env pull .env.local

# 開発サーバー起動
npm run dev
```

### 本番環境デプロイ：

詳細は [DEPLOY.md](DEPLOY.md) を参照してください。

1. GitHubにプッシュ
2. Vercelダッシュボードでインポート
3. Vercel KVデータベースを作成
4. プロジェクトにリンク
5. 自動デプロイ

## 💡 使い方

1. アプリを開く（2つのブラウザ/タブ）
2. 各ユーザーのIDをコピー
3. 相手のIDを入力
4. 「接続開始」をクリック
5. P2P接続が確立されたらチャット開始

## 🔧 カスタマイズ

### ポーリング間隔の変更
[hooks/useWebRTC.ts](hooks/useWebRTC.ts):
```typescript
pollingInterval.current = setInterval(pollSignals, 2000); // 2秒 → 任意の値
```

### データ削除時間の変更
[app/api/signaling/route.ts](app/api/signaling/route.ts):
```typescript
await kv.expire(key, 300); // 5分 → 任意の秒数
```

### STUNサーバーの追加
[hooks/useWebRTC.ts](hooks/useWebRTC.ts):
```typescript
const config: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:your-stun-server.com:3478' }, // 追加
  ],
};
```

## 🔐 セキュリティ

- P2P通信で直接データ送信
- 一時的なデータ保存のみ
- セキュリティヘッダー設定済み
- 今後の拡張: エンドツーエンド暗号化

## 📝 今後の拡張案

- [ ] Web Push API通知の完全実装
- [ ] エンドツーエンド暗号化
- [ ] ファイル送信機能
- [ ] グループチャット
- [ ] メッセージ履歴の永続化（データベース）
- [ ] ビデオ/音声通話
- [ ] 画面共有

## 🐛 トラブルシューティング

### 接続できない
- STUNサーバーが利用可能か確認
- Vercel KVが正しく設定されているか確認
- ブラウザのWebRTC対応を確認

### メッセージが届かない
- 接続状態を確認
- ブラウザコンソールのエラーをチェック
- Vercel関数ログを確認

### Vercel KVエラー
```bash
# 環境変数を再取得
vercel env pull .env.local --force
```

## 📚 参考リンク

- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv)
- [Next.js](https://nextjs.org/docs)

## 🎉 完成！

このアプリはVercel無料プランで完全に動作します。
デプロイして実際に使ってみてください！
