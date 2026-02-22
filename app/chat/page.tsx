'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';
import dynamic from 'next/dynamic';
import ContactRequestNotification from '@/components/ContactRequestNotification';

const QRCodeExchange = dynamic(() => import('@/components/QRCodeExchange'), {
    ssr: false,
});

type Message = {
    id: string;
    text: string;
    sender: 'me' | 'them';
    timestamp: number;
    status?: 'sending' | 'sent' | 'offline';
    serverMessageId?: string; // サーバー保存時のID
};

type Contact = {
    id: string;
    name: string;
    peerId: string;
    addedAt: number;
};

type ChatHistory = {
    [peerId: string]: Message[];
};

type ContactRequest = {
    id: string;
    from: string;
    to: string;
    status: string;
    timestamp: number;
};

export default function ChatPage() {
    const { data: session, status } = useSession();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatHistory>({});
    const [inputText, setInputText] = useState('');
    const [newContactId, setNewContactId] = useState('');
    const [newContactName, setNewContactName] = useState('');
    const [showAddContact, setShowAddContact] = useState(false);
    const [showQRCode, setShowQRCode] = useState(false);
    const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
    const [showChat, setShowChat] = useState(false); // モバイル用チャット表示フラグ
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const [isLoaded, setIsLoaded] = useState(false);
    const isFetchingMessages = useRef(false); // メッセージ取得中フラグ

    const myId = session?.user?.id || '';
    const peerId = selectedContact?.peerId || '';

    // localStorageからchatHistoryを読み込む
    useEffect(() => {
        if (typeof window !== 'undefined' && myId) {
            const storageKey = `chatHistory_${myId}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    console.log('📦 Loaded chat history from localStorage:', Object.keys(parsed));
                    setChatHistory(parsed);
                } catch (error) {
                    console.error('Failed to parse saved chat history:', error);
                }
            }
            setIsLoaded(true);
        }
    }, [myId]);

    // chatHistoryをlocalStorageに保存
    useEffect(() => {
        if (typeof window !== 'undefined' && myId && isLoaded) {
            const storageKey = `chatHistory_${myId}`;
            localStorage.setItem(storageKey, JSON.stringify(chatHistory));
            console.log('💾 Saved chat history to localStorage');
        }
    }, [chatHistory, myId, isLoaded]);

    // 通知許可状態を監視
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // メッセージ受信ハンドラー
    const handleReceiveMessage = useCallback(
        (text: string, timestamp: number) => {
            if (!selectedContact) return;

            const newMessage: Message = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text,
                sender: 'them',
                timestamp,
                status: 'sent',
            };

            setChatHistory((prev) => ({
                ...prev,
                [selectedContact.peerId]: [
                    ...(prev[selectedContact.peerId] || []),
                    newMessage,
                ],
            }));
        },
        [selectedContact]
    );

    // オフラインメッセージチェック要求を受信した時のハンドラー
    const handleOfflineMessageNotification = useCallback(() => {
        console.log('✉️ Peer requested offline message check');
        fetchOfflineMessages();
    }, [myId, isLoaded]);

    // メッセージ配信確認ハンドラー（オフラインメッセージが相手に届いた）
    const handleMessageDelivered = useCallback((serverMessageIds: string[]) => {
        console.log('📬 Updating message status for delivered messages:', serverMessageIds);

        setChatHistory((prev) => {
            const updated = { ...prev };

            // すべての連絡先のメッセージをチェック
            for (const peerId in updated) {
                updated[peerId] = updated[peerId].map(msg => {
                    // サーバーメッセージIDが一致し、ステータスがofflineのものをsentに更新
                    if (msg.serverMessageId && serverMessageIds.includes(msg.serverMessageId) && msg.status === 'offline') {
                        console.log('✅ Marking message as sent:', msg.id);
                        return { ...msg, status: 'sent' as const };
                    }
                    return msg;
                });
            }

            return updated;
        });
    }, []);

    // WebRTC接続フック
    const { connectionState, connect, sendMessage, notifyMessageDelivery } = useWebRTC(
        myId,
        peerId,
        handleReceiveMessage,
        handleOfflineMessageNotification,
        handleMessageDelivered
    );

    const fetchContacts = async () => {
        try {
            const response = await fetch('/api/contacts');
            if (response.ok) {
                const { contacts } = await response.json();
                setContacts(contacts);
            }
        } catch (error) {
            console.error('Failed to fetch contacts:', error);
        }
    };

    // 連絡先リクエストを取得
    const fetchContactRequests = async () => {
        try {
            const response = await fetch('/api/contact-requests');
            if (response.ok) {
                const { requests } = await response.json();
                setContactRequests(requests);
            }
        } catch (error) {
            console.error('Failed to fetch contact requests:', error);
        }
    };

    // プッシュ通知の登録
    const registerPushNotification = async () => {
        console.log('🔔 Checking notification support...');

        // Notificationサポートチェック
        if (!('Notification' in window)) {
            console.warn('❌ This browser does not support notifications');
            alert('このブラウザは通知をサポートしていません');
            return;
        }

        // 現在の許可状態をチェック
        console.log('Current notification permission:', Notification.permission);

        // 既に許可されている場合
        if (Notification.permission === 'granted') {
            console.log('✅ Notifications already granted');
            setNotificationPermission('granted');
            registerServiceWorker();
            return;
        }

        // 既に拒否されている場合
        if (Notification.permission === 'denied') {
            console.warn('❌ Notifications were previously denied. Please enable in browser settings.');
            alert('通知は拒否されています。ブラウザの設定から通知を有効にしてください。');
            return;
        }

        // 許可をリクエスト（permission === 'default'の場合）
        try {
            console.log('📢 Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            setNotificationPermission(permission);

            if (permission === 'granted') {
                console.log('✅ Notification permission granted!');
                alert('通知が有効になりました！');
                registerServiceWorker();
            } else {
                console.warn('❌ Notification permission denied');
                alert('通知が拒否されました');
            }
        } catch (error) {
            console.error('Failed to request notification permission:', error);
            alert('通知の許可リクエストに失敗しました: ' + error);
        }
    };

    // Service Workerを登録
    const registerServiceWorker = async () => {
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Worker not supported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker registered:', registration);
        } catch (error) {
            console.error('❌ Failed to register service worker:', error);
        }
    };

    // オフラインメッセージを取得
    const fetchOfflineMessages = async () => {
        if (!myId || !isLoaded) {
            console.log('⏭️ Skipping offline message fetch: myId=', myId, 'isLoaded=', isLoaded);
            return;
        }

        // 既に取得中の場合はスキップ
        if (isFetchingMessages.current) {
            console.log('⏭️ Already fetching messages, skipping...');
            return;
        }

        isFetchingMessages.current = true;
        console.log('📥 Fetching offline messages for:', myId);

        try {
            const response = await fetch(`/api/messages?userId=${myId}`);
            console.log('📥 Server response status:', response.status);

            if (response.ok) {
                const { messages } = await response.json();
                console.log('📥 Received offline messages:', messages);
                console.log('📥 Number of messages:', messages?.length || 0);

                if (messages && messages.length > 0) {
                    const deliveredMessageIds: string[] = [];

                    // メッセージをチャット履歴に追加
                    setChatHistory((prev) => {
                        const updated = { ...prev };

                        for (const msg of messages) {
                            // 既存のメッセージIDをチェック
                            const existingMessages = updated[msg.from] || [];
                            const isDuplicate = existingMessages.some(m => m.id === msg.id);

                            if (!isDuplicate) {
                                const newMessage: Message = {
                                    id: msg.id,
                                    text: msg.text,
                                    sender: 'them',
                                    timestamp: msg.timestamp,
                                    status: 'sent',
                                };

                                updated[msg.from] = [...existingMessages, newMessage];
                                deliveredMessageIds.push(msg.id);
                                console.log('📥 Added offline message from:', msg.from);
                            } else {
                                console.log('⏭️ Skipped duplicate message:', msg.id);
                            }
                        }

                        // timestampでソート（昔いメッセージが上）
                        for (const peerId in updated) {
                            updated[peerId] = updated[peerId].sort((a, b) => a.timestamp - b.timestamp);
                        }

                        return updated;
                    });

                    // 送信者に配信確認を通知（P2P接続中の場合）
                    if (deliveredMessageIds.length > 0 && connectionState === 'connected') {
                        console.log('📬 Notifying sender about delivered messages:', deliveredMessageIds);
                        notifyMessageDelivery(deliveredMessageIds);
                    }

                    // メッセージを表示したので削除（デバッグのため一時的に無効化）
                    // setTimeout(async () => {
                    //   console.log('📥 Deleting displayed offline messages');
                    //   await fetch(`/api/messages?userId=${myId}`, {
                    //     method: 'DELETE',
                    //   });
                    // }, 1000);
                }
            }
        } catch (error) {
            console.error('Failed to fetch offline messages:', error);
        } finally {
            isFetchingMessages.current = false;
        }
    };

    // 通知をチェック
    const checkNotifications = async () => {
        if (!myId) return;

        console.log('🔔 Checking notifications for:', myId);
        try {
            const response = await fetch(`/api/notifications?userId=${myId}`);
            if (response.ok) {
                const { notifications } = await response.json();
                console.log('🔔 Received notifications:', notifications);

                if (notifications && notifications.length > 0) {
                    // 通知をブラウザで表示
                    for (const notif of notifications) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            console.log('🔔 Showing notification:', notif);
                            new Notification(notif.from, {
                                body: notif.message,
                                icon: '/icon-192x192.png',
                                tag: 'message-notification'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check notifications:', error);
        }
    };

    // 連絡先を読み込む
    useEffect(() => {
        const loadData = async () => {
            if (myId && isLoaded) {
                await fetchContacts();
                await fetchContactRequests();
                await fetchOfflineMessages(); // オフラインメッセージを取得
                await registerPushNotification(); // プッシュ通知を登録
                await checkNotifications(); // 通知をチェック
            }
        };
        void loadData();
    }, [myId, isLoaded]);

    // タブが表示されたときにオフラインメッセージを取得
    useEffect(() => {
        if (!myId || !isLoaded) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('📱 Tab became visible, fetching offline messages');
                fetchOfflineMessages();
                checkNotifications();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [myId, isLoaded]);

    // 定期的にオフラインメッセージをチェック（30秒ごと）
    useEffect(() => {
        if (!myId || !isLoaded) return;

        const interval = setInterval(() => {
            console.log('⏰ Periodic check for offline messages');
            fetchOfflineMessages();
        }, 10000); // 10秒ごと

        return () => clearInterval(interval);
    }, [myId, isLoaded]);

    // 連絡先リクエストを定期的に取得
    useEffect(() => {
        if (!myId) return;

        const interval = setInterval(() => {
            fetchContactRequests();
        }, 3000); // 3秒ごと

        return () => clearInterval(interval);
    }, [status]);

    // 連絡先を追加
    const addContact = async () => {
        if (!newContactId.trim()) return;

        try {
            const response = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    peerId: newContactId,
                    name: newContactName || newContactId,
                }),
            });

            if (response.ok) {
                await fetchContacts();
                setNewContactId('');
                setNewContactName('');
                setShowAddContact(false);
            }
        } catch (error) {
            console.error('Failed to add contact:', error);
        }
    };

    // 連絡先を削除
    const deleteContact = async (contactId: string) => {
        try {
            const response = await fetch(`/api/contacts?id=${contactId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await fetchContacts();
                if (selectedContact?.id === contactId) {
                    setSelectedContact(null);
                }
            }
        } catch (error) {
            console.error('Failed to delete contact:', error);
        }
    };

    // QRコードで連絡先リクエストを送信
    const handleContactRequest = async (targetUserId: string) => {
        try {
            const response = await fetch('/api/contact-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId }),
            });

            if (!response.ok) {
                console.error('Failed to send contact request');
            }
        } catch (error) {
            console.error('Failed to send contact request:', error);
        }
    };

    // 連絡先リクエストを承認
    const handleApproveRequest = async (requestId: string, fromUserId: string) => {
        try {
            const response = await fetch('/api/contact-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action: 'approve' }),
            });

            if (response.ok) {
                await fetchContacts();
                await fetchContactRequests();
            }
        } catch (error) {
            console.error('Failed to approve request:', error);
        }
    };

    // 連絡先リクエストを拒否
    const handleRejectRequest = async (requestId: string) => {
        try {
            const response = await fetch('/api/contact-requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action: 'reject' }),
            });

            if (response.ok) {
                await fetchContactRequests();
            }
        } catch (error) {
            console.error('Failed to reject request:', error);
        }
    };

    // 連絡先を選択
    const selectContact = async (contact: Contact) => {
        // 接続前にオフラインメッセージを取得して履歴に追加
        // これにより接続開始前にメッセージが表示されることを保証
        if (myId) {
            console.log('📥 Fetching offline messages before connection...');
            await fetchOfflineMessages();
        }

        setSelectedContact(contact);
        setShowChat(true); // モバイルでチャット画面を表示
    };

    // 選択された連絡先が変更されたら接続
    useEffect(() => {
        if (selectedContact && myId) {
            connect();
        }
    }, [selectedContact, myId, connect]);

    // メッセージ送信
    const handleSend = async () => {
        if (!inputText.trim() || !selectedContact) return;

        const newMessage: Message = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            text: inputText,
            sender: 'me',
            timestamp: Date.now(),
            status: 'sending',
        };

        setChatHistory((prev) => ({
            ...prev,
            [selectedContact.peerId]: [
                ...(prev[selectedContact.peerId] || []),
                newMessage,
            ],
        }));
        setInputText('');

        const result = await sendMessage(inputText);

        console.log('Message send result:', result.success ? 'P2P success' : 'Stored offline');

        setChatHistory((prev) => ({
            ...prev,
            [selectedContact.peerId]: prev[selectedContact.peerId].map((msg) =>
                msg.id === newMessage.id
                    ? {
                        ...msg,
                        status: result.success ? 'sent' : 'offline',
                        serverMessageId: result.serverMessageId // サーバーメッセージIDを保存
                    }
                    : msg
            ),
        }));
    };

    // ローディング中
    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="text-xl font-bold">読み込み中...</div>
                </div>
            </div>
        );
    }

    // 未ログインの場合はログイン画面
    if (status === 'unauthenticated') {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h1 className="text-2xl font-bold mb-6 text-center">
                        P2P チャットアプリ
                    </h1>
                    <p className="text-gray-600 mb-6 text-center">
                        ログインして連絡先を保存しましょう
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => signIn('google')}
                            className="w-full bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 font-bold"
                        >
                            Google でログイン
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">
                        ログインすると、あなたのIDと連絡先がサーバーに保存されます
                    </p>
                </div>
            </div>
        );
    }

    const messages = selectedContact
        ? chatHistory[selectedContact.peerId] || []
        : [];

    return (
        <>
            {/* 連絡先リクエスト通知 */}
            <ContactRequestNotification
                requests={contactRequests}
                onApprove={handleApproveRequest}
                onReject={handleRejectRequest}
            />

            {/* QRコードモーダル */}
            {showQRCode && (
                <QRCodeExchange
                    myUserId={myId}
                    onContactRequest={handleContactRequest}
                    onClose={() => setShowQRCode(false)}
                />
            )}

            <main className="flex h-screen bg-gray-100 text-gray-800 font-sans">
                {/* サイドバー：連絡先リスト */}
                <div className={`${showChat ? 'hidden' : 'flex'} md:flex w-full md:w-1/3 bg-white border-r flex-col`}>
                    {/* ユーザー情報 */}
                    <div className="p-4 border-b bg-blue-50">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="font-bold text-sm">{session?.user?.name}</div>
                                <div className="text-xs text-gray-600">{session?.user?.email}</div>
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                            >
                                ログアウト
                            </button>
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                            <div className="font-mono bg-white p-2 rounded border text-xs break-all">
                                ID: {myId}
                            </div>
                        </div>
                    </div>

                    {/* 連絡先追加ボタン */}
                    <div className="p-4 border-b">
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setShowAddContact(!showAddContact)}
                                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-bold text-sm"
                            >
                                + 手動追加
                            </button>
                            <button
                                onClick={() => setShowQRCode(true)}
                                className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-bold text-sm"
                            >
                                📷 QRコード
                            </button>
                        </div>

                        {/* 通知許可ボタン */}
                        {notificationPermission === 'default' && (
                            <button
                                onClick={registerPushNotification}
                                className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 font-bold text-sm mb-2"
                            >
                                🔔 通知を有効化
                            </button>
                        )}

                        {notificationPermission === 'denied' && (
                            <div className="w-full bg-red-100 text-red-700 px-4 py-2 rounded text-xs mb-2">
                                通知が拒否されています。ブラウザの設定から許可してください。
                            </div>
                        )}

                        {/* リクエスト一覧へのリンク */}
                        {contactRequests.length > 0 && (
                            <button
                                onClick={() => window.location.href = '/requests'}
                                className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 font-bold text-sm mt-2 flex items-center justify-center gap-2"
                            >
                                📬 リクエスト ({contactRequests.length})
                            </button>
                        )}

                        {showAddContact && (
                            <div className="mt-3 space-y-2">
                                <input
                                    className="w-full text-sm border p-2 rounded"
                                    placeholder="相手のID"
                                    value={newContactId}
                                    onChange={(e) => setNewContactId(e.target.value)}
                                />
                                <input
                                    className="w-full text-sm border p-2 rounded"
                                    placeholder="名前（オプション）"
                                    value={newContactName}
                                    onChange={(e) => setNewContactName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={addContact}
                                        className="flex-1 bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600"
                                    >
                                        追加
                                    </button>
                                    <button
                                        onClick={() => setShowAddContact(false)}
                                        className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-400"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 連絡先リスト */}
                    <div className="flex-1 overflow-y-auto">
                        {contacts.length === 0 && (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                連絡先がありません
                            </div>
                        )}
                        {contacts.map((contact) => (
                            <div
                                key={contact.id}
                                onClick={() => selectContact(contact)}
                                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedContact?.id === contact.id ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="font-bold text-sm">{contact.name}</div>
                                        <div className="text-xs text-gray-600 truncate">
                                            {contact.peerId}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteContact(contact.id);
                                        }}
                                        className="text-red-500 text-xs hover:text-red-700"
                                    >
                                        削除
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* チャット画面 */}
                <div className={`${showChat ? 'flex' : 'hidden'} md:flex w-full md:w-2/3 flex-col`}>
                    {selectedContact ? (
                        <>
                            {/* チャットヘッダー */}
                            <div className="p-4 bg-white border-b flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    {/* モバイル用戻るボタン */}
                                    <button
                                        onClick={() => setShowChat(false)}
                                        className="md:hidden text-blue-500 hover:text-blue-700"
                                    >
                                        ← 戻る
                                    </button>
                                    <div>
                                        <div className="font-bold">{selectedContact.name}</div>
                                        <div className="text-xs text-gray-600">
                                            {selectedContact.peerId}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`w-3 h-3 rounded-full ${connectionState === 'connected'
                                                ? 'bg-green-500'
                                                : connectionState === 'connecting'
                                                    ? 'bg-yellow-500 animate-pulse'
                                                    : 'bg-red-500'
                                            }`}
                                    />
                                    <span className="text-sm">
                                        {connectionState === 'connected'
                                            ? '接続済み'
                                            : connectionState === 'connecting'
                                                ? '接続中'
                                                : '未接続'}
                                    </span>
                                </div>
                            </div>

                            {/* メッセージ一覧 */}
                            <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-400 mt-8">
                                        <p>メッセージはまだありません</p>
                                    </div>
                                )}
                                {messages.map((msg) => {
                                    const date = new Date(msg.timestamp);
                                    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'
                                                } mb-2`}
                                        >
                                            <div
                                                className={`p-3 rounded-lg max-w-xs ${msg.sender === 'me'
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-white border'
                                                    }`}
                                            >
                                                <div>{msg.text}</div>
                                                <div className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-blue-100' : 'text-gray-500'}`}>
                                                    {dateStr}
                                                </div>
                                                {msg.status && msg.sender === 'me' && (
                                                    <div className="text-xs mt-1 opacity-70">
                                                        {msg.status === 'sending' && '送信中...'}
                                                        {msg.status === 'sent' && '✓'}
                                                        {msg.status === 'offline' && '📤 オフライン保存'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* 入力エリア */}
                            <div className="p-4 bg-white border-t flex gap-2">
                                <input
                                    className="flex-1 border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="メッセージを入力..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                />
                                <button
                                    onClick={handleSend}
                                    className="bg-blue-500 text-white px-6 rounded hover:bg-blue-600 font-bold"
                                >
                                    送信
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-gray-50">
                            <div className="text-center text-gray-400">
                                <p className="text-xl">連絡先を選択してください</p>
                                <p className="text-sm mt-2">
                                    左のリストから会話したい相手を選んでください
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
