'use client';

import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ContactRequest = {
    id: string;
    from: string;
    to: string;
    status: string;
    timestamp: number;
};

type UserInfo = {
    id: string;
    name: string;
    email?: string;
};

export default function RequestsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [requests, setRequests] = useState<ContactRequest[]>([]);
    const [userNames, setUserNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<Set<string>>(new Set());

    // リクエストを取得
    const fetchRequests = async () => {
        try {
            const response = await fetch('/api/contact-requests');
            if (response.ok) {
                const { requests: fetchedRequests } = await response.json();
                setRequests(fetchedRequests);

                // ユーザー名を取得
                for (const request of fetchedRequests) {
                    if (!userNames[request.from]) {
                        try {
                            const userResponse = await fetch(`/api/users/${request.from}`);
                            if (userResponse.ok) {
                                const userData: UserInfo = await userResponse.json();
                                setUserNames(prev => ({ ...prev, [request.from]: userData.name }));
                            }
                        } catch (error) {
                            console.error('Failed to fetch user name:', error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch requests:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (session?.user?.id) {
            void fetchRequests();
        }
    }, [session]);

    // リクエストを承認
    const handleApprove = async (requestId: string, fromUserId: string) => {
        if (processing.has(requestId)) return;
        setProcessing(prev => new Set(prev).add(requestId));

        try {
            const response = await fetch('/api/contact-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action: 'approve' }),
            });

            if (response.ok) {
                await fetchRequests();
            }
        } catch (error) {
            console.error('Failed to approve request:', error);
        } finally {
            setProcessing(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    // リクエストを拒否
    const handleReject = async (requestId: string) => {
        if (processing.has(requestId)) return;
        setProcessing(prev => new Set(prev).add(requestId));

        try {
            const response = await fetch('/api/contact-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action: 'reject' }),
            });

            if (response.ok) {
                await fetchRequests();
            }
        } catch (error) {
            console.error('Failed to reject request:', error);
        } finally {
            setProcessing(prev => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    // 全削除
    const handleDeleteAll = async () => {
        if (!confirm('すべてのリクエストを削除しますか？')) return;

        try {
            const response = await fetch('/api/contact-requests', {
                method: 'DELETE',
            });

            if (response.ok) {
                setRequests([]);
            }
        } catch (error) {
            console.error('Failed to delete all requests:', error);
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="text-xl font-bold">読み込み中...</div>
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold mb-6 text-center">
                        ログインが必要です
                    </h1>
                    <button
                        onClick={() => signIn()}
                        className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 font-bold"
                    >
                        ログイン
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* ヘッダー */}
            <div className="bg-white border-b">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/chat')}
                            className="text-blue-500 hover:text-blue-700"
                        >
                            ← チャットに戻る
                        </button>
                        <h1 className="text-xl font-bold">連絡先リクエスト</h1>
                    </div>
                    {requests.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 text-sm font-bold"
                        >
                            全削除
                        </button>
                    )}
                </div>
            </div>

            {/* コンテンツ */}
            <div className="max-w-4xl mx-auto px-4 py-6">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="text-gray-600">読み込み中...</div>
                    </div>
                ) : requests.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <div className="text-xl font-bold text-gray-700 mb-2">
                            リクエストはありません
                        </div>
                        <div className="text-gray-500">
                            QRコードで連絡先を交換すると、ここに表示されます
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="bg-white rounded-lg shadow p-4 flex items-start gap-4"
                            >
                                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-blue-600 text-2xl">👤</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">
                                                {userNames[request.from] || request.from}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {new Date(request.timestamp).toLocaleString('ja-JP')}
                                            </p>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${request.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : request.status === 'approved'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}
                                        >
                                            {request.status === 'pending' && '保留中'}
                                            {request.status === 'approved' && '承認済み'}
                                            {request.status === 'rejected' && '拒否済み'}
                                        </span>
                                    </div>

                                    {request.status === 'pending' && (
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleApprove(request.id, request.from)}
                                                disabled={processing.has(request.id)}
                                                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                承認
                                            </button>
                                            <button
                                                onClick={() => handleReject(request.id)}
                                                disabled={processing.has(request.id)}
                                                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-bold hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                拒否
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
