import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { auth } from '@/auth';

export const maxDuration = 10;

// 連絡先リクエストを送信
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
    }

    const fromUserId = session.user.id;
    const requestId = `${fromUserId}-${Date.now()}`;
    
    // リクエストを保存 (24時間保持)
    const request = {
      id: requestId,
      from: fromUserId,
      to: targetUserId,
      status: 'pending',
      timestamp: Date.now(),
    };

    await kv.set(`contact-request:${requestId}`, JSON.stringify(request), {
      ex: 86400, // 24時間
    });

    // ターゲットユーザーの受信リクエストリストに追加
    const requestsKey = `contact-requests:${targetUserId}`;
    await kv.sadd(requestsKey, requestId);
    await kv.expire(requestsKey, 86400);

    return NextResponse.json({ success: true, requestId });
  } catch (error) {
    console.error('Error sending contact request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 自分宛ての連絡先リクエストを取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const requestsKey = `contact-requests:${userId}`;
    
    // リクエストIDリストを取得
    const requestIds = await kv.smembers(requestsKey);
    
    if (!requestIds || requestIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // 各リクエストの詳細を取得
    const requests = [];
    for (const requestId of requestIds) {
      const data = await kv.get(`contact-request:${requestId}`);
      if (data) {
        const request = typeof data === 'string' ? JSON.parse(data) : data;
        if (request.status === 'pending') {
          requests.push(request);
        } else {
          // 承認済み/拒否済みリクエストは削除
          await kv.srem(requestsKey, requestId);
        }
      }
    }

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Error fetching contact requests:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 連絡先リクエストを承認/拒否
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, action } = await req.json();
    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const userId = session.user.id;
    const data = await kv.get(`contact-request:${requestId}`);
    
    if (!data) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const request = typeof data === 'string' ? JSON.parse(data) : data;

    // リクエストが自分宛か確認
    if (request.to !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'approve') {
      // 両方のユーザーの連絡先リストに相手を追加
      const contact1 = { id: request.from, addedAt: Date.now() };
      const contact2 = { id: request.to, addedAt: Date.now() };

      await kv.sadd(`contacts:${request.to}`, JSON.stringify(contact1));
      await kv.sadd(`contacts:${request.from}`, JSON.stringify(contact2));

      // 相手に承認通知を送信
      const notification = {
        type: 'contact_approved',
        from: userId,
        timestamp: Date.now(),
      };
      await kv.set(`notification:${request.from}`, JSON.stringify(notification), {
        ex: 300, // 5分
      });
    }

    // リクエストを削除
    await kv.del(`contact-request:${requestId}`);
    await kv.srem(`contact-requests:${userId}`, requestId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing contact request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
