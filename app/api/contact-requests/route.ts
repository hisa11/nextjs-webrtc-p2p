import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { auth } from "@/auth";

export const maxDuration = 10;

// 全リクエストを削除
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: deleted } = await supabaseAdmin
      .from("contact_requests")
      .delete()
      .eq("to_user_id", userId)
      .select("id");

    return NextResponse.json({ success: true, deleted: deleted?.length ?? 0 });
  } catch (error) {
    console.error("Error deleting all requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 連絡先リクエストを送信
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID required" },
        { status: 400 },
      );
    }

    const fromUserId = session.user.id;

    // 既に同じユーザーからの pending リクエストがあるかチェック
    const { data: existing } = await supabaseAdmin
      .from("contact_requests")
      .select("id")
      .eq("from_user_id", fromUserId)
      .eq("to_user_id", targetUserId)
      .eq("status", "pending")
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        requestId: existing.id,
        duplicate: true,
      });
    }

    const requestId = `${fromUserId}-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 86400000).toISOString();

    await supabaseAdmin.from("contact_requests").insert({
      id: requestId,
      from_user_id: fromUserId,
      to_user_id: targetUserId,
      status: "pending",
      timestamp: Date.now(),
      expires_at: expiresAt,
    });

    return NextResponse.json({ success: true, requestId });
  } catch (error) {
    console.error("Error sending contact request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 自分宛ての連絡先リクエストを取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: rows } = await supabaseAdmin
      .from("contact_requests")
      .select("*")
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString());

    const requests = (rows || []).map((row) => ({
      id: row.id,
      from: row.from_user_id,
      to: row.to_user_id,
      status: row.status,
      timestamp: row.timestamp,
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Error fetching contact requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 連絡先リクエストを承認/拒否
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, action } = await req.json();
    if (!requestId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const userId = session.user.id;

    const { data: requestData } = await supabaseAdmin
      .from("contact_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (!requestData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // リクエストが自分宛か確認
    if (requestData.to_user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (action === "approve") {
      // ユーザー情報を取得
      const [{ data: fromUser }, { data: toUser }] = await Promise.all([
        supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", requestData.from_user_id)
          .single(),
        supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", requestData.to_user_id)
          .single(),
      ]);

      const now = Date.now();

      // 両方のユーザーの連絡先リストに相手を追加
      await supabaseAdmin.from("contacts").upsert([
        {
          id: `${requestData.to_user_id}-${requestData.from_user_id}`,
          user_id: requestData.to_user_id,
          peer_id: requestData.from_user_id,
          name: fromUser?.name || requestData.from_user_id,
          added_at: now,
        },
        {
          id: `${requestData.from_user_id}-${requestData.to_user_id}`,
          user_id: requestData.from_user_id,
          peer_id: requestData.to_user_id,
          name: toUser?.name || requestData.to_user_id,
          added_at: now,
        },
      ]);

      // 相手に承認通知を送信
      await supabaseAdmin.from("notifications").insert({
        to_user_id: requestData.from_user_id,
        from_user: userId,
        message: "Contact request approved",
        timestamp: now,
      });
    }

    // リクエストを削除
    await supabaseAdmin.from("contact_requests").delete().eq("id", requestId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing contact request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
