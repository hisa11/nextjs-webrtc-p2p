import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

// ピアのオンライン状態を確認
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const peerId = searchParams.get("peerId");

    if (!peerId) {
      return NextResponse.json({ error: "Missing peerId" }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from("online_status")
      .select("last_seen")
      .eq("user_id", peerId)
      .single();

    const isOnline = data && Date.now() - data.last_seen < 30000;

    return NextResponse.json({
      peerId,
      online: isOnline,
      lastSeen: data ? new Date(data.last_seen).toISOString() : null,
    });
  } catch (error) {
    console.error("Check peer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
