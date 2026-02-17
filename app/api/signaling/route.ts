import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

// Vercel無料プランの制限に対応：10秒以内に処理を完了させる
export const maxDuration = 10;

type SignalData = {
  type: 'offer' | 'answer' | 'ice-candidate';
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
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const signal: SignalData = {
      type,
      data,
      from,
      to,
      timestamp: Date.now(),
    };

    // Vercel KVに保存（相手が取得するまで保持）
    // キー: signal:{to}:{from} で保存し、受信者が取得しやすくする
    const key = `signal:${to}:${from}`;
    await kv.lpush(key, JSON.stringify(signal));
    
    // 5分で自動削除（Vercel無料プランのKV容量を節約）
    await kv.expire(key, 300);

    // オンライン状態を更新
    await kv.set(`online:${from}`, Date.now(), { ex: 30 }); // 30秒で期限切れ

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signaling error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// シグナルデータを取得（ポーリング方式）
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

    // この関数で取得できるすべてのシグナルを集める
    const pattern = `signal:${userId}:*`;
    const keys = await kv.keys(pattern);
    
    const signals: SignalData[] = [];
    
    for (const key of keys) {
      // リストから全て取得して削除
      const items = await kv.lrange(key, 0, -1);
      if (items && items.length > 0) {
        for (const item of items) {
          try {
            signals.push(JSON.parse(item as string));
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
        // 取得したら削除
        await kv.del(key);
      }
    }

    // オンライン状態を更新
    await kv.set(`online:${userId}`, Date.now(), { ex: 30 });

    return NextResponse.json({ signals });
  } catch (error) {
    console.error('Get signals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
