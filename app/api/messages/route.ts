import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

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
    const { text, from, to } = body;

    if (!text || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 相手がオンラインかチェック
    const onlineStatus = await kv.get(`online:${to}`);
    const isOnline = onlineStatus && (Date.now() - (onlineStatus as number) < 30000);

    if (isOnline) {
      // オンラインの場合は保存不要
      return NextResponse.json({ stored: false, reason: 'recipient_online' });
    }

    // オフラインの場合はメッセージを保存
    const message: OfflineMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      from,
      to,
      timestamp: Date.now(),
    };

    const key = `messages:${to}`;
    await kv.lpush(key, JSON.stringify(message));
    
    // 24時間で自動削除（Vercel無料プランの容量節約）
    await kv.expire(key, 86400);

    return NextResponse.json({ stored: true, messageId: message.id });
  } catch (error) {
    console.error('Store message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// オフラインメッセージを取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const key = `messages:${userId}`;
    const items = await kv.lrange(key, 0, -1);
    
    const messages: OfflineMessage[] = [];
    
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          messages.push(JSON.parse(item as string));
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
      // 取得したら削除
      await kv.del(key);
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
