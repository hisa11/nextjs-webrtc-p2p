import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

// ピアのオンライン状態を確認
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const peerId = searchParams.get('peerId');

    if (!peerId) {
      return NextResponse.json(
        { error: 'Missing peerId' },
        { status: 400 }
      );
    }

    const onlineStatus = await kv.get(`online:${peerId}`);
    const isOnline = onlineStatus && (Date.now() - (onlineStatus as number) < 30000);

    return NextResponse.json({ 
      peerId,
      online: isOnline,
      lastSeen: onlineStatus ? new Date(onlineStatus as number).toISOString() : null
    });
  } catch (error) {
    console.error('Check peer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
