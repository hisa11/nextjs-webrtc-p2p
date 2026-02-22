import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// クライアントサイド用（公開キー）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// サーバーサイド用（サービスロールキー）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
