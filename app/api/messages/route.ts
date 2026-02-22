import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

type OfflineMessage = {
  id: string;
  text: string;
  from: string;
  to: string;
  timestamp: number;
};

// オフラインメッセージを保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, from, to, timestamp } = body;

    if (!text || !from || !to) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    console.log(`[Messages] Storing message for ${to} (always save mode)`);

    const message: OfflineMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      from,
      to,
      timestamp: timestamp || Date.now(),
    };

    // Supabase にメッセージを保存
    await supabaseAdmin.from("messages").insert({
      id: message.id,
      text: message.text,
      from_user_id: message.from,
      to_user_id: message.to,
      timestamp: message.timestamp,
    });

    console.log(
      `[Messages] Message saved with ID:`,
      message.id,
      "timestamp:",
      message.timestamp,
    );

    // 送信者の名前を取得
    const { data: fromUserData } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", from)
      .single();
    const fromName = fromUserData?.name || from;

    // 通知を保存
    await supabaseAdmin.from("notifications").insert({
      to_user_id: to,
      from_user: fromName,
      message: text.slice(0, 50),
      timestamp: timestamp || Date.now(),
    });

    console.log(`[Messages] Stored offline message for ${to} from ${fromName}`);

    return NextResponse.json({ stored: true, messageId: message.id });
  } catch (error) {
    console.error("Store message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// オフラインメッセージを取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    console.log(`[Messages] Fetching messages for ${userId}`);

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("to_user_id", userId)
      .order("timestamp", { ascending: true });

    const messages: OfflineMessage[] = (rows || []).map((row) => ({
      id: row.id,
      text: row.text,
      from: row.from_user_id,
      to: row.to_user_id,
      timestamp: row.timestamp,
    }));

    console.log(
      `[Messages] Retrieved ${messages.length} messages, sorted by timestamp`,
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// オフラインメッセージを削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    await supabaseAdmin.from("messages").delete().eq("to_user_id", userId);

    console.log(`[Messages] Deleted all messages for ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
