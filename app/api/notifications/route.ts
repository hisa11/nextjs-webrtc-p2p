import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

type NotificationRequest = {
  to: string;
  message: string;
  from: string;
};

// 通知を送信（実際にはフラグを立てるだけ）
// Web Push APIは別途実装が必要ですが、ここではシンプルな通知フラグを保存
export async function POST(request: NextRequest) {
  try {
    const body: NotificationRequest = await request.json();
    const { to, message, from } = body;

    if (!to || !message || !from) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 通知フラグを保存（相手がオンラインになったときに取得）
    const notification = {
      from,
      message: message.slice(0, 50), // 最初の50文字のみ
      timestamp: Date.now(),
    };

    const key = `notifications:${to}`;
    await kv.lpush(key, JSON.stringify(notification));
    await kv.expire(key, 86400); // 24時間で削除

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 未読通知を取得
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

    const key = `notifications:${userId}`;
    const items = await kv.lrange(key, 0, -1);
    
    const notifications = [];
    
    if (items && items.length > 0) {
      for (const item of items) {
        try {
          notifications.push(JSON.parse(item as string));
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
      // 取得したら削除
      await kv.del(key);
    }

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
