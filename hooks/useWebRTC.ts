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
  onMessage: (message: string, timestamp: number) => void,
  onOfflineMessageNotification?: () => void,
  onMessageDelivered?: (serverMessageIds: string[]) => void,
) {
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatReceived = useRef<number>(Date.now());
  const heartbeatCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const pendingAcks = useRef<Map<string, NodeJS.Timeout>>(new Map());

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
      console.log("Received offer, current state:", signalingState);

      try {
        // stable状態またはhave-local-offer状態（グレア）の場合のみ処理
        if (
          signalingState !== "stable" &&
          signalingState !== "have-local-offer"
        ) {
          console.warn("Cannot handle offer in state:", signalingState);
          return;
        }

        // グレア状態の解決: 低いIDが優先
        if (signalingState === "have-local-offer") {
          const shouldRestart = myId < peerId;
          if (!shouldRestart) {
            console.log("Ignoring offer due to glare, we have priority");
            return;
          }
          console.log("Restarting due to glare");
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
      console.log("Received answer, current state:", signalingState);

      // have-local-offer状態のみでanswerを処理
      if (signalingState !== "have-local-offer") {
        console.warn("Cannot handle answer in state:", signalingState);
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
        console.log(
          "Waiting for remote description before adding ICE candidate",
        );
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
        console.error("Signaling API error:", response.status);
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
      } else if (state === "failed") {
        console.warn("Connection failed, will retry...");
        setConnectionState("disconnected");
        // 接続失敗時は5秒後に自動再試行
        setTimeout(() => {
          if (
            peerConnection.current &&
            peerConnection.current.iceConnectionState === "failed"
          ) {
            console.log("Retrying connection...");
            peerConnection.current.restartIce();
          }
        }, 5000);
      } else if (state === "disconnected" || state === "closed") {
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
        lastHeartbeatReceived.current = Date.now();

        // 接続確立時に相手にオフラインメッセージチェックを通知
        if (dataChannel.current) {
          try {
            dataChannel.current.send(
              JSON.stringify({ type: "check-offline-messages" }),
            );
            console.log("✉️ Sent offline message check notification to peer");
          } catch (error) {
            console.error("Failed to send offline message check:", error);
          }
        }

        // ハートビート送信開始（1秒毎）
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        heartbeatInterval.current = setInterval(() => {
          if (dataChannel.current?.readyState === "open") {
            try {
              dataChannel.current.send(JSON.stringify({ type: "heartbeat" }));
            } catch (error) {
              console.error("Failed to send heartbeat:", error);
            }
          }
        }, 1000);

        // ハートビート受信チェック（3秒以上受信なしで切断）
        if (heartbeatCheckInterval.current) {
          clearInterval(heartbeatCheckInterval.current);
        }
        heartbeatCheckInterval.current = setInterval(() => {
          const timeSinceLastHeartbeat =
            Date.now() - lastHeartbeatReceived.current;
          if (timeSinceLastHeartbeat > 3000) {
            console.warn("Heartbeat timeout, connection lost");
            setConnectionState("disconnected");
            if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
            }
            if (heartbeatCheckInterval.current) {
              clearInterval(heartbeatCheckInterval.current);
            }
          }
        }, 1000);
      };

      dataChannel.current.onclose = () => {
        console.log("Data channel closed");
        setConnectionState("disconnected");
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        if (heartbeatCheckInterval.current) {
          clearInterval(heartbeatCheckInterval.current);
        }
      };
    };

    // ポーリング開始（500msごとに高速チェック）
    pollingInterval.current = setInterval(pollSignals, 500);

    // オフラインメッセージは親コンポーネントで取得するため、ここでは取得しない

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (heartbeatCheckInterval.current) {
        clearInterval(heartbeatCheckInterval.current);
      }
      peerConnection.current?.close();
    };
  }, [myId, peerId, onMessage, pollSignals, sendSignal]);

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
        lastHeartbeatReceived.current = Date.now();

        // 接続確立時に相手にオフラインメッセージチェックを通知
        if (dataChannel.current) {
          try {
            dataChannel.current.send(
              JSON.stringify({ type: "check-offline-messages" }),
            );
            console.log("✉️ Sent offline message check notification to peer");
          } catch (error) {
            console.error("Failed to send offline message check:", error);
          }
        }

        // ハートビート送信開始（1秒毎）
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        heartbeatInterval.current = setInterval(() => {
          if (dataChannel.current?.readyState === "open") {
            try {
              dataChannel.current.send(JSON.stringify({ type: "heartbeat" }));
            } catch (error) {
              console.error("Failed to send heartbeat:", error);
            }
          }
        }, 1000);

        // ハートビート受信チェック（3秒以上受信なしで切断）
        if (heartbeatCheckInterval.current) {
          clearInterval(heartbeatCheckInterval.current);
        }
        heartbeatCheckInterval.current = setInterval(() => {
          const timeSinceLastHeartbeat =
            Date.now() - lastHeartbeatReceived.current;
          if (timeSinceLastHeartbeat > 3000) {
            console.warn("Heartbeat timeout, connection lost");
            setConnectionState("disconnected");
            if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
            }
            if (heartbeatCheckInterval.current) {
              clearInterval(heartbeatCheckInterval.current);
            }
          }
        }, 1000);
      };

      dataChannel.current.onclose = () => {
        console.log("Data channel closed");
        setConnectionState("disconnected");
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        if (heartbeatCheckInterval.current) {
          clearInterval(heartbeatCheckInterval.current);
        }
      };

      dataChannel.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "heartbeat") {
            // ハートビート受信
            lastHeartbeatReceived.current = Date.now();
          } else if (data.type === "message") {
            // 通常メッセージ受信 → ACK送信
            onMessage(data.text, data.timestamp);
            // ACK応答を送信
            if (dataChannel.current?.readyState === "open") {
              try {
                dataChannel.current.send(
                  JSON.stringify({
                    type: "ack",
                    messageId: data.messageId,
                  }),
                );
                console.log("✅ Sent ACK for message:", data.messageId);
              } catch (error) {
                console.error("Failed to send ACK:", error);
              }
            }
          } else if (data.type === "ack") {
            // ACK受信 → タイムアウトをクリア
            const timeout = pendingAcks.current.get(data.messageId);
            if (timeout) {
              clearTimeout(timeout);
              pendingAcks.current.delete(data.messageId);
              console.log("✅ Received ACK for message:", data.messageId);
            }
          } else if (data.type === "check-offline-messages") {
            // オフラインメッセージチェック要求
            console.log(
              "✉️ Received offline message check notification from peer",
            );
            if (onOfflineMessageNotification) {
              onOfflineMessageNotification();
            }
          } else if (data.type === "delivery-confirmation") {
            // メッセージ配信確認を受信
            console.log(
              "📬 Received delivery confirmation for messages:",
              data.serverMessageIds,
            );
            if (onMessageDelivered && data.serverMessageIds) {
              onMessageDelivered(data.serverMessageIds);
            }
          }
        } catch (error) {
          // JSONパースに失敗した場合は通常のテキストメッセージとして扱う
          onMessage(event.data, Date.now());
        }
      };
    }
  }, [sendSignal, onMessage, onOfflineMessageNotification, onMessageDelivered]);

  // メッセージを送信（サーバーメッセージIDを返す）
  const sendMessage = useCallback(
    async (
      message: string,
    ): Promise<{ success: boolean; serverMessageId?: string }> => {
      const timestamp = Date.now();
      const messageId = `${myId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

      // 接続状態とデータチャンネルの両方をチェック
      const isConnected =
        connectionState === "connected" &&
        dataChannel.current?.readyState === "open";

      console.log(
        "Sending message, connectionState:",
        connectionState,
        "dataChannel state:",
        dataChannel.current?.readyState,
      );

      if (isConnected && dataChannel.current) {
        try {
          // P2P送信
          dataChannel.current.send(
            JSON.stringify({
              type: "message",
              text: message,
              messageId,
              timestamp,
            }),
          );
          console.log("✅ Message sent via P2P, waiting for ACK...");

          // ACKを待つ（3秒タイムアウト）
          return new Promise<{ success: boolean; serverMessageId?: string }>(
            (resolve) => {
              const timeout = setTimeout(async () => {
                // ACKが返ってこなかったのでサーバーに保存
                console.log("⚠️ ACK timeout, storing on server");
                pendingAcks.current.delete(messageId);
                try {
                  const response = await fetch("/api/messages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: message,
                      from: myId,
                      to: peerId,
                      timestamp,
                    }),
                  });
                  const result = await response.json();
                  console.log(
                    "📤 Stored on server due to ACK timeout, messageId:",
                    result.messageId,
                  );
                  resolve({
                    success: false,
                    serverMessageId: result.messageId,
                  });
                } catch (error) {
                  console.error(
                    "Failed to save message after ACK timeout:",
                    error,
                  );
                  resolve({ success: false });
                }
              }, 3000);

              pendingAcks.current.set(messageId, timeout);

              // ACK受信時にタイムアウトがクリアされ、resolveされる
              const checkAck = setInterval(() => {
                if (!pendingAcks.current.has(messageId)) {
                  clearInterval(checkAck);
                  resolve({ success: true });
                }
              }, 100);
            },
          );
        } catch (error) {
          console.error("Failed to send via P2P:", error);
          // P2P送信失敗時はサーバーに保存
        }
      }

      // オフラインまたは送信失敗の場合はサーバーに保存
      console.log("📤 Storing message on server (offline)");
      console.log("📤 Message details:", {
        text: message,
        from: myId,
        to: peerId,
      });
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: message,
            from: myId,
            to: peerId,
            timestamp,
          }),
        });
        const result = await response.json();
        console.log("📤 Server store result:", result);
        console.log("📤 Response status:", response.status);
        return { success: false, serverMessageId: result.messageId }; // オフライン保存
      } catch (error) {
        console.error("Failed to save offline message:", error);
        return { success: false };
      }
    },
    [myId, peerId, connectionState],
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

  // メッセージ配信確認を送信
  const notifyMessageDelivery = useCallback((serverMessageIds: string[]) => {
    if (dataChannel.current?.readyState === "open") {
      try {
        dataChannel.current.send(
          JSON.stringify({
            type: "delivery-confirmation",
            serverMessageIds,
          }),
        );
        console.log(
          "📬 Sent delivery confirmation for messages:",
          serverMessageIds,
        );
      } catch (error) {
        console.error("Failed to send delivery confirmation:", error);
      }
    }
  }, []);

  return {
    connectionState,
    connect,
    sendMessage,
    checkPeerOnline,
    notifyMessageDelivery,
  };
}
