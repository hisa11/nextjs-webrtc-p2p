'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
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

  const myId = session?.user?.id || '';
  const peerId = selectedContact?.peerId || '';

  // メッセージ受信ハンドラー
  const handleReceiveMessage = useCallback(
    (text: string) => {
      if (!selectedContact) return;

      const newMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        text,
        sender: 'them',
        timestamp: Date.now(),
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

  // WebRTC接続フック
  const { connectionState, connect, sendMessage } = useWebRTC(
    myId,
    peerId,
    handleReceiveMessage
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

  // 連絡先を読み込む
  useEffect(() => {
    const loadData = async () => {
      if (myId) {
        await fetchContacts();
        await fetchContactRequests();
      }
    };
    void loadData();
  }, [myId]);

  // 連絡先リクエストを定期的に取得
  useEffect(() => {
    if (!myId) return;

    const interval = setInterval(() => {
      fetchContactRequests();
    }, 5000); // 5秒ごと

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

      if (response.ok) {
        alert('連絡先リクエストを送信しました');
        setShowQRCode(false);
      } else {
        alert('リクエストの送信に失敗しました');
      }
    } catch (error) {
      console.error('Failed to send contact request:', error);
      alert('エラーが発生しました');
    }
  };

  // 連絡先リクエストを承認
  const handleApproveRequest = async (requestId: string) => {
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
  const selectContact = (contact: Contact) => {
    setSelectedContact(contact);
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

    const sent = await sendMessage(inputText);

    setChatHistory((prev) => ({
      ...prev,
      [selectedContact.peerId]: prev[selectedContact.peerId].map((msg) =>
        msg.id === newMessage.id
          ? { ...msg, status: sent ? 'sent' : 'offline' }
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
              onClick={() => signIn('github')}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg hover:bg-gray-700 font-bold"
            >
              GitHub でログイン
            </button>
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
      <div className="w-1/3 bg-white border-r flex flex-col">
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
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                selectedContact?.id === contact.id ? 'bg-blue-50' : ''
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
      <div className="w-2/3 flex flex-col">
        {selectedContact ? (
          <>
            {/* チャットヘッダー */}
            <div className="p-4 bg-white border-b flex justify-between items-center">
              <div>
                <div className="font-bold">{selectedContact.name}</div>
                <div className="text-xs text-gray-600">
                  {selectedContact.peerId}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    connectionState === 'connected'
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
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === 'me' ? 'justify-end' : 'justify-start'
                  } mb-2`}
                >
                  <div
                    className={`p-3 rounded-lg max-w-xs ${
                      msg.sender === 'me'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white border'
                    }`}
                  >
                    <div>{msg.text}</div>
                    {msg.status && msg.sender === 'me' && (
                      <div className="text-xs mt-1 opacity-70">
                        {msg.status === 'sending' && '送信中...'}
                        {msg.status === 'sent' && '✓'}
                        {msg.status === 'offline' && '📤 オフライン保存'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
