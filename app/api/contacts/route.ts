import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { peerId, name } = body;

    if (!peerId) {
      return NextResponse.json(
        { error: 'Missing peerId' },
        { status: 400 }
      );
    }

    const contact: Contact = {
      id: `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: name || peerId,
      peerId,
      addedAt: Date.now(),
    };

    const key = `contacts:${session.user.id}`;
    await kv.lpush(key, JSON.stringify(contact));

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('Add contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 連絡先一覧を取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = `contacts:${session.user.id}`;
    const items = await kv.lrange(key, 0, -1);

    const contacts: Contact[] = [];
    
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          if (typeof item === 'string') {
            contacts.push(JSON.parse(item));
          } else {
            contacts.push(item as Contact);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 連絡先を削除
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('id');

    if (!contactId) {
      return NextResponse.json(
        { error: 'Missing contact id' },
        { status: 400 }
      );
    }

    const key = `contacts:${session.user.id}`;
    const items = await kv.lrange(key, 0, -1);

    const newContacts: Contact[] = [];
    
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          let contact: Contact;
          if (typeof item === 'string') {
            contact = JSON.parse(item);
          } else {
            contact = item as Contact;
          }
          
          if (contact.id !== contactId) {
            newContacts.push(contact);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }

    // 既存のリストを削除して新しいリストを作成
    await kv.del(key);
    for (const contact of newContacts) {
      await kv.rpush(key, JSON.stringify(contact));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
