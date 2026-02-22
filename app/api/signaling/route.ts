import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

type SignalData = {
  type: "offer" | "answer" | "ice-candidate";
  data: unknown;
  from: string;
  to: string;
  timestamp: number;
};

// シグナルデータを送信
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, from, to } = body;

    if (!type || !from || !to) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const signal: SignalData = {
      type,
      data,
      from,
      to,
      timestamp: Date.now(),
    };

    // Supabase にシグナルを保存
    await supabaseAdmin.from("signals").insert({
      type: signal.type,
      data: signal.data,
      from_user_id: signal.from,
      to_user_id: signal.to,
      timestamp: signal.timestamp,
    });

    // オンライン状態を更新
    await supabaseAdmin.from("online_status").upsert({
      user_id: from,
      last_seen: Date.now(),
      updated_at: new Date().toISOString(),
    });

    // 5分以上前のシグナルを削除（容量節約）
    const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
    await supabaseAdmin
      .from("signals")
      .delete()
      .lt("created_at", fiveMinutesAgo);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signaling error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// シグナルデータを取得（ポーリング方式）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 自分宛てのシグナルを取得
    const { data: rows } = await supabaseAdmin
      .from("signals")
      .select("*")
      .eq("to_user_id", userId)
      .order("timestamp", { ascending: true });

    const signals: SignalData[] = (rows || []).map((row) => ({
      type: row.type as SignalData["type"],
      data: row.data,
      from: row.from_user_id,
      to: row.to_user_id,
      timestamp: row.timestamp,
    }));

    // 取得したら削除
    if (signals.length > 0) {
      await supabaseAdmin.from("signals").delete().eq("to_user_id", userId);
    }

    // オンライン状態を更新
    await supabaseAdmin.from("online_status").upsert({
      user_id: userId,
      last_seen: Date.now(),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error("Get signals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
