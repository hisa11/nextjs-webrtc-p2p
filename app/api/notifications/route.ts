import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

type NotificationRequest = {
  to: string;
  message: string;
  from: string;
};

// 通知を送信
export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { to, message, from } = body;

    if (!to || !message || !from) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await supabaseAdmin.from("notifications").insert({
      to_user_id: to,
      from_user: from,
      message: message.slice(0, 50),
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 未読通知を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const { data: items } = await supabaseAdmin
      .from("notifications")
      .select("from_user, message, timestamp")
      .eq("to_user_id", userId)
      .order("created_at", { ascending: false });

    const notifications = (items || []).map((item) => ({
      from: item.from_user,
      message: item.message,
      timestamp: item.timestamp,
    }));

    // 取得したら削除
    if (notifications.length > 0) {
      await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("to_user_id", userId);
    }

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
