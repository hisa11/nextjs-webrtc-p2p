'use client';

import { useState, useEffect, useRef } from 'react';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
};

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  // WebRTC用の状態
  const [sdp, setSdp] = useState(''); // 自分のSDPを表示する用
  const [remoteSdp, setRemoteSdp] = useState(''); // 相手のSDPを入力する用
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // 起動時にRTCPeerConnectionを準備
  useEffect(() => {
    // Googleの無料STUNサーバーを使う設定
    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
    peerConnection.current = new RTCPeerConnection(config);

    peerConnection.current.oniceconnectionstatechange = () => {
      console.log("接続状態:", peerConnection.current?.iceConnectionState);
    };

    // 接続の準備（ICE Candidate）ができた時
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        // 本来はこれも送る必要がありますが、今回はSDPに全部含まれるのを待ちます
        // (簡易実装のため、SDP生成完了後に手動コピーします)
      } else {
        // 全ての準備完了！このSDPをコピーします
        if (peerConnection.current?.localDescription) {
          setSdp(JSON.stringify(peerConnection.current.localDescription));
        }
      }
    };

    // データチャンネル（チャット用回線）を受け取る処理
    // データチャンネル（チャット用回線）を受け取る処理
    peerConnection.current.ondatachannel = (event) => {
      console.log("① データチャネルを受信しました！"); // 確認OK

      const receiveChannel = event.channel;

      // 👇 ここのコメントアウト「//」を消してください！
      dataChannelRef.current = receiveChannel;
      // 👆 これでBさんも、この「receiveChannel」を使って返信できるようになります

      receiveChannel.onmessage = (e) => {
        console.log("② メッセージが届いた！", e.data);

        // メッセージを画面に追加
        const newMessage: Message = {
          id: Date.now().toString() + Math.random().toString(36).slice(2), // 簡易ID
          text: e.data,
          sender: 'them',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, newMessage]);
      };
    };

    return () => {
      peerConnection.current?.close();
    };
  }, []);

  // 1. Offerを作成する（Aさんが押す）
  const createOffer = async () => {
    if (!peerConnection.current) return;
    // データチャンネルを作成（これがないと接続できません）
    const dc = peerConnection.current.createDataChannel("chat");
    dataChannelRef.current = dc;
    dc.onopen = () => console.log("DataChannel Open!");
    
    // Aさん側でもメッセージを受信できるように設定
    dc.onmessage = (e) => {
      console.log("② メッセージが届いた（A側）！", e.data);
      
      const newMessage: Message = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        text: e.data,
        sender: 'them',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    // onicecandidateが発火してSDPが表示されるのを待ちます
  };

  // 2. Answerを作成する（Bさんが押す）
  const createAnswer = async () => {
    if (!peerConnection.current || !remoteSdp) return;
    const desc = new RTCSessionDescription(JSON.parse(remoteSdp));
    await peerConnection.current.setRemoteDescription(desc);

    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
  };

  // 3. 相手のAnswerを登録する（Aさんが最後に押す）
  const setRemoteAnswer = async () => {
    if (!peerConnection.current || !remoteSdp) return;
    const desc = new RTCSessionDescription(JSON.parse(remoteSdp));
    await peerConnection.current.setRemoteDescription(desc);
  };

  // 送信処理（WebRTC経由に変更）
  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      text: inputText,
      sender: 'me',
      timestamp: Date.now(),
    };

    // 👇 ここを書き換えて、詳しい状況を教えてもらいましょう
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      console.log("🚚 送信成功！:", inputText);
      dataChannelRef.current.send(inputText);
    } else {
      console.log("❌ 送信失敗... 状態:", dataChannelRef.current?.readyState);
      console.log("(まだ相手とつながっていないか、準備中です)");
    }
    // 👆 ここまで

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
  };

  return (
    <main className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      <div className="w-1/3 bg-white border-r p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="font-bold text-lg">📶 手動接続パネル</h2>

        <div className="p-3 bg-blue-50 rounded border">
          <h3 className="font-bold text-sm mb-2">① Offerを作る (Aさん)</h3>
          <button onClick={createOffer} className="bg-blue-500 text-white px-3 py-1 rounded text-sm w-full">Offer生成</button>
        </div>

        <div className="p-3 bg-green-50 rounded border">
          <h3 className="font-bold text-sm mb-2">② 相手のSDPを入力</h3>
          <textarea
            className="w-full h-20 text-xs border p-1"
            placeholder="ここに相手のSDPをペースト"
            value={remoteSdp}
            onChange={(e) => setRemoteSdp(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={createAnswer} className="bg-green-500 text-white px-2 py-1 rounded text-xs flex-1">Answer生成 (Bさん)</button>
            <button onClick={setRemoteAnswer} className="bg-purple-500 text-white px-2 py-1 rounded text-xs flex-1">Answer登録 (Aさん)</button>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded border">
          <h3 className="font-bold text-sm mb-2">③ 自分のSDP (コピーして相手へ)</h3>
          <textarea
            readOnly
            className="w-full h-20 text-xs border p-1 bg-gray-100"
            value={sdp}
          />
          <button
            onClick={() => navigator.clipboard.writeText(sdp)}
            className="bg-gray-500 text-white px-3 py-1 rounded text-sm w-full mt-2"
          >
            コピーする
          </button>
        </div>
      </div>

      <div className="w-2/3 flex flex-col">
        {/* チャット画面（前回と同じ） */}
        <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'} mb-2`}>
              <div className={`p-3 rounded-lg max-w-xs ${msg.sender === 'me' ? 'bg-blue-500 text-white' : 'bg-white border'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <input
            className="flex-1 border p-2 rounded"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
          />
          <button onClick={handleSend} className="bg-blue-500 text-white px-4 rounded">送信</button>
        </div>
      </div>
    </main>
  );
}
