// WebRTC接続を管理するカスタムフック
import { useEffect, useRef, useCallback, useState } from "react";

interface SignalData {
  type: "offer" | "answer" | "ice-candidate";
  data: unknown;
  from: string;
  to: string;
  timestamp: number;
}

interface OfflineMessage {
  id: string;
  text: string;
  from: string;
  to: string;
  timestamp: number;
}

export function useWebRTC(
  myId: string,
  peerId: string,
  onMessage: (message: string) => void,
) {
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // シグナルデータを送信
  const sendSignal = useCallback(
    async (type: string, data: unknown) => {
      try {
        await fetch("/api/signaling", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            data,
            from: myId,
            to: peerId,
          }),
        });
      } catch (error) {
        console.error("Failed to send signal:", error);
      }
    },
    [myId, peerId],
  );

  // Offerを受信
  const handleOffer = useCallback(
    async (offer: RTCSessionDescriptionInit) => {
      if (!peerConnection.current) return;

      const signalingState = peerConnection.current.signalingState;
      console.log('Received offer, current state:', signalingState);

      try {
        // stable状態またはhave-local-offer状態（グレア）の場合のみ処理
        if (signalingState !== 'stable' && signalingState !== 'have-local-offer') {
          console.warn('Cannot handle offer in state:', signalingState);
          return;
        }

        // グレア状態の解決: 低いIDが優先
        if (signalingState === 'have-local-offer') {
          const shouldRestart = myId < peerId;
          if (!shouldRestart) {
            console.log('Ignoring offer due to glare, we have priority');
            return;
          }
          console.log('Restarting due to glare');
        }

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        await sendSignal("answer", answer);
      } catch (error) {
        console.error("Handle offer error:", error);
      }
    },
    [sendSignal, myId, peerId],
  );

  // Answerを受信
  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      if (!peerConnection.current) return;

      const signalingState = peerConnection.current.signalingState;
      console.log('Received answer, current state:', signalingState);

      // have-local-offer状態のみでanswerを処理
      if (signalingState !== 'have-local-offer') {
        console.warn('Cannot handle answer in state:', signalingState);
        return;
      }

      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (error) {
        console.error("Handle answer error:", error);
      }
    },
    [],
  );

  // ICE Candidateを受信
  const handleIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      if (!peerConnection.current) return;

      // リモートdescriptionが設定されるまで待つ
      if (!peerConnection.current.remoteDescription) {
        console.log("Waiting for remote description before adding ICE candidate");
        return;
      }

      try {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(candidate),
        );
      } catch (error) {
        console.error("Handle ICE candidate error:", error);
      }
    },
    [],
  );

  // シグナルデータをポーリング
  const pollSignals = useCallback(async () => {
    try {
      const response = await fetch(`/api/signaling?userId=${myId}`);
      
      if (!response.ok) {
        console.error('Signaling API error:', response.status);
        return;
      }
      
      const data = await response.json();
      const signals = data.signals || [];

      for (const signal of signals) {
        if (signal.from !== peerId) continue;

        if (signal.type === "offer") {
          await handleOffer(signal.data as RTCSessionDescriptionInit);
        } else if (signal.type === "answer") {
          await handleAnswer(signal.data as RTCSessionDescriptionInit);
        } else if (signal.type === "ice-candidate") {
          await handleIceCandidate(signal.data as RTCIceCandidateInit);
        }
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, [myId, peerId, handleOffer, handleAnswer, handleIceCandidate]);

  // オフラインメッセージを取得
  const fetchOfflineMessages = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages?userId=${myId}`);
      
      if (!response.ok) {
        console.error('Messages API error:', response.status);
        return;
      }
      
      const data = await response.json();
      const messages = data.messages || [];

      for (const msg of messages) {
        if (msg.from === peerId) {
          onMessage(msg.text);
        }
      }
    } catch (error) {
      console.error("Fetch offline messages error:", error);
    }
  }, [myId, peerId, onMessage]);

  // WebRTC接続を初期化
  useEffect(() => {
    if (!myId || !peerId) return;

    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    peerConnection.current = new RTCPeerConnection(config);

    // 接続状態の監視
    peerConnection.current.oniceconnectionstatechange = () => {
      const state = peerConnection.current?.iceConnectionState;
      console.log("ICE connection state:", state);

      if (state === "connected" || state === "completed") {
        setConnectionState("connected");
      } else if (
        state === "disconnected" ||
        state === "failed" ||
        state === "closed"
      ) {
        setConnectionState("disconnected");
      } else {
        setConnectionState("connecting");
      }
    };

    // ICE Candidateの送信
    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice-candidate", event.candidate.toJSON());
      }
    };

    // データチャンネルの受信
    peerConnection.current.ondatachannel = (event) => {
      dataChannel.current = event.channel;
      setupDataChannel();
    };

    // データチャンネルのセットアップ
    const setupDataChannel = () => {
      if (!dataChannel.current) return;

      dataChannel.current.onopen = () => {
        console.log("Data channel opened");
        setConnectionState("connected");
      };

      dataChannel.current.onclose = () => {
        console.log("Data channel closed");
        setConnectionState("disconnected");
      };

      dataChannel.current.onmessage = (event) => {
        onMessage(event.data);
      };
    };

    // ポーリング開始
    pollingInterval.current = setInterval(pollSignals, 2000);

    // オフラインメッセージを取得
    fetchOfflineMessages();

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      peerConnection.current?.close();
    };
  }, [myId, peerId, onMessage, pollSignals, sendSignal, fetchOfflineMessages]);

  // 接続を開始（Offerを作成）
  const connect = useCallback(async () => {
    if (!peerConnection.current) return;

    try {
      setConnectionState("connecting");

      // データチャンネルを作成
      dataChannel.current = peerConnection.current.createDataChannel("chat");
      setupDataChannel();

      // Offerを作成して送信
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      await sendSignal("offer", offer);
    } catch (error) {
      console.error("Connect error:", error);
      setConnectionState("disconnected");
    }

    function setupDataChannel() {
      if (!dataChannel.current) return;

      dataChannel.current.onopen = () => {
        console.log("Data channel opened");
        setConnectionState("connected");
      };

      dataChannel.current.onclose = () => {
        console.log("Data channel closed");
        setConnectionState("disconnected");
      };

      dataChannel.current.onmessage = (event) => {
        onMessage(event.data);
      };
    }
  }, [sendSignal, onMessage]);

  // メッセージを送信
  const sendMessage = useCallback(
    async (message: string) => {
      if (dataChannel.current?.readyState === "open") {
        dataChannel.current.send(message);
        return true;
      } else {
        // オフラインの場合はサーバーに保存
        try {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: message,
              from: myId,
              to: peerId,
            }),
          });
          return false; // オフライン保存
        } catch (error) {
          console.error("Failed to save offline message:", error);
          return false;
        }
      }
    },
    [myId, peerId],
  );

  // 相手のオンライン状態を確認
  const checkPeerOnline = useCallback(async () => {
    try {
      const response = await fetch(`/api/peers?peerId=${peerId}`);
      const { online } = await response.json();
      return online;
    } catch (error) {
      console.error("Check peer online error:", error);
      return false;
    }
  }, [peerId]);

  return {
    connectionState,
    connect,
    sendMessage,
    checkPeerOnline,
  };
}
