import { supabaseAdmin } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 10;

type Contact = {
  id: string;
  name: string;
  peerId: string;
  addedAt: number;
};

// 連絡先を追加
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { peerId, name } = body;

    if (!peerId) {
      return NextResponse.json({ error: "Missing peerId" }, { status: 400 });
    }

    const contact: Contact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name || peerId,
      peerId,
      addedAt: Date.now(),
    };

    await supabaseAdmin.from("contacts").insert({
      id: contact.id,
      user_id: session.user.id,
      peer_id: contact.peerId,
      name: contact.name,
      added_at: contact.addedAt,
    });

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error("Add contact error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 連絡先一覧を取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rows } = await supabaseAdmin
      .from("contacts")
      .select("id, peer_id, name, added_at")
      .eq("user_id", session.user.id);

    const contacts: Contact[] = await Promise.all(
      (rows || []).map(async (row) => {
        let name = row.name;
        // nameがpeerIdと同じ場合、ユーザー情報から名前を取得
        if (name === row.peer_id) {
          const { data: userData } = await supabaseAdmin
            .from("users")
            .select("name")
            .eq("id", row.peer_id)
            .single();
          if (userData?.name) {
            name = userData.name;
          }
        }
        return {
          id: row.id,
          peerId: row.peer_id,
          name,
          addedAt: row.added_at,
        };
      }),
    );

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Get contacts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// 連絡先を削除
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("id");

    if (!contactId) {
      return NextResponse.json(
        { error: "Missing contact id" },
        { status: 400 },
      );
    }

    await supabaseAdmin
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .eq("user_id", session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete contact error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
