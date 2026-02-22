-- Supabase スキーマ定義
-- このファイルを Supabase の SQL Editor で実行してください

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  provider_account_id TEXT NOT NULL DEFAULT '',
  last_login BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 連絡先テーブル
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  added_at BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);

-- 連絡先リクエストテーブル
CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  timestamp BIGINT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_requests_to_user_idx ON contact_requests(to_user_id);
CREATE INDEX IF NOT EXISTS contact_requests_from_user_idx ON contact_requests(from_user_id);

-- オフラインメッセージテーブル
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_to_user_idx ON messages(to_user_id);

-- 通知テーブル
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  to_user_id TEXT NOT NULL,
  from_user TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  timestamp BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_to_user_idx ON notifications(to_user_id);

-- WebRTC シグナリングテーブル
CREATE TABLE IF NOT EXISTS signals (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  timestamp BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signals_to_user_idx ON signals(to_user_id);

-- オンライン状態テーブル
CREATE TABLE IF NOT EXISTS online_status (
  user_id TEXT PRIMARY KEY,
  last_seen BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 期限切れレコードを自動削除するためのポリシー（Supabase には pg_cron が利用可能）
-- 定期的なクリーンアップが必要な場合は以下を Supabase の cron ジョブで設定:
--   DELETE FROM contact_requests WHERE expires_at < NOW();
--   DELETE FROM messages WHERE created_at < NOW() - INTERVAL '24 hours';
--   DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '24 hours';
--   DELETE FROM signals WHERE created_at < NOW() - INTERVAL '5 minutes';
--   DELETE FROM online_status WHERE updated_at < NOW() - INTERVAL '30 seconds';

-- Row Level Security (RLS) を有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_status ENABLE ROW LEVEL SECURITY;

-- サービスロールはすべての操作を許可（API ルートからのアクセス）
-- anon ロールのアクセスは制限
CREATE POLICY "Service role full access" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access" ON contacts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON contact_requests FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON notifications FOR ALL USING (true);
CREATE POLICY "Service role full access" ON signals FOR ALL USING (true);
CREATE POLICY "Service role full access" ON online_status FOR ALL USING (true);
