'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebRTC } from '@/hooks/useWebRTC';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
  status?: 'sending' | 'sent' | 'offline';
};

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [myId, setMyId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // メッセージ受信ハンドラー
  const handleReceiveMessage = useCallback((text: string) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text,
      sender: 'them',
      timestamp: Date.now(),
      status: 'sent',
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // WebRTC接続フック
  const { connectionState, connect, sendMessage } = useWebRTC(
    myId,
    peerId,
    handleReceiveMessage
  );

  // 接続状態の監視
  useEffect(() => {
    setIsConnected(connectionState === 'connected');
  }, [connectionState]);

  // 接続状態の監視
  useEffect(() => {
    setIsConnected(connectionState === 'connected');
  }, [connectionState]);

  // 初回起動時にユーザーIDを生成または復元
  useEffect(() => {
    const storedId = localStorage.getItem('myUserId');
    if (storedId) {
      setMyId(storedId);
    } else {
      const newId = `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem('myUserId', newId);
      setMyId(newId);
    }
  }, []);

  // 接続を開始
  const handleConnect = async () => {
    if (!myId || !peerId) {
      alert('相手のIDを入力してください');
      return;
    }
    await connect();
  };

  // メッセージ送信
  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: inputText,
      sender: 'me',
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    // メッセージ送信
    const sent = await sendMessage(inputText);

    // 送信状態を更新
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === newMessage.id
          ? { ...msg, status: sent ? 'sent' : 'offline' }
          : msg
      )
    );
  };

  return (
    <main className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      {/* サイドバー：接続パネル */}
      <div className="w-1/3 bg-white border-r p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="font-bold text-lg">🌐 P2P接続設定</h2>

        {/* 自分のID */}
        <div className="p-3 bg-blue-50 rounded border">
          <h3 className="font-bold text-sm mb-2">あなたのID</h3>
          <div className="flex gap-2">
            <input
              readOnly
              className="flex-1 text-xs border p-2 bg-gray-100 rounded"
              value={myId}
            />
            <button
              onClick={() => navigator.clipboard.writeText(myId)}
              className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              コピー
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            このIDを相手に共有してください
          </p>
        </div>

        {/* 相手のID入力 */}
        <div className="p-3 bg-green-50 rounded border">
          <h3 className="font-bold text-sm mb-2">相手のID</h3>
          <input
            className="w-full text-sm border p-2 rounded"
            placeholder="相手のIDを入力"
            value={peerId}
            onChange={(e) => setPeerId(e.target.value)}
          />
          <button
            onClick={handleConnect}
            disabled={!peerId || connectionState === 'connecting'}
            className={`w-full mt-2 px-4 py-2 rounded text-sm font-bold ${connectionState === 'connecting'
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
              }`}
          >
            {connectionState === 'connecting' ? '接続中...' : '接続開始'}
          </button>
        </div>

        {/* 接続状態 */}
        <div className="p-3 bg-gray-50 rounded border">
          <h3 className="font-bold text-sm mb-2">接続状態</h3>
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
          <p className="text-xs text-gray-600 mt-2">
            {connectionState === 'connected'
              ? 'P2P接続が確立されています'
              : connectionState === 'connecting'
                ? 'ピアと接続を確立中です...'
                : 'オフラインメッセージは自動で保存されます'}
          </p>
        </div>

        {/* 説明 */}
        <div className="p-3 bg-purple-50 rounded border">
          <h3 className="font-bold text-sm mb-2">💡 使い方</h3>
          <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
            <li>あなたのIDをコピーして相手に共有</li>
            <li>相手のIDを入力して「接続開始」</li>
            <li>接続後はP2P通信でチャット</li>
            <li>相手がオフラインでもメッセージは保存されます</li>
          </ol>
        </div>
      </div>

      {/* チャット画面 */}
      <div className="w-2/3 flex flex-col">
        <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-8">
              <p>メッセージはまだありません</p>
              <p className="text-sm mt-2">相手と接続してチャットを開始しましょう</p>
            </div>
          )}
          {messages.map((msg) => (
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
            placeholder={
              isConnected
                ? 'メッセージを入力...'
                : 'オフライン時もメッセージ送信可能'
            }
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
      </div>
    </main>
  );
}
