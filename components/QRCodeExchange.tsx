'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

interface QRCodeExchangeProps {
    myUserId: string;
    onContactRequest: (userId: string) => void;
    onClose: () => void;
}

export default function QRCodeExchange({ myUserId, onContactRequest, onClose }: QRCodeExchangeProps) {
    const [mode, setMode] = useState<'show' | 'scan'>('show');
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerDivId = 'qr-reader';

    // QRコードのデータ形式: webrtc-chat://user/{userId}
    const qrData = `webrtc-chat://user/${myUserId}`;

    // QRコードを読み取った時の処理
    const handleQRCodeScanned = useCallback(async (data: string) => {
        if (processing) return; // 処理中は無視
        setProcessing(true);

        if (scannerRef.current && scanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }
        setScanning(false);

        // データ形式を検証
        const match = data.match(/^webrtc-chat:\/\/user\/(.+)$/);
        if (!match) {
            setError('無効なQRコードです。');
            setProcessing(false);
            return;
        }

        const scannedUserId = match[1];

        // 自分自身のQRコードをスキャンした場合
        if (scannedUserId === myUserId) {
            setError('自分自身のQRコードです。');
            setProcessing(false);
            return;
        }

        // 連絡先リクエストを送信
        try {
            await onContactRequest(scannedUserId);
            setSuccess('リクエストを送信しました！');
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            setError('リクエストの送信に失敗しました。');
            setProcessing(false);
        }
    }, [myUserId, onContactRequest, scanning, onClose, processing]);

    // スキャナーを起動
    const startScanner = useCallback(async () => {
        try {
            setError(null);
            setScanning(true);

            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode(scannerDivId);
            }

            await scannerRef.current.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    // QRコードを読み取った
                    handleQRCodeScanned(decodedText);
                },
                () => {
                    // スキャンエラー（無視）
                }
            );
        } catch (err: unknown) {
            console.error('Camera error:', err);
            setError('カメラの起動に失敗しました。カメラの権限を確認してください。');
            setScanning(false);
        }
    }, [scannerDivId, handleQRCodeScanned]);

    // スキャナーを停止
    const stopScanner = useCallback(async () => {
        if (scannerRef.current && scanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }
        setScanning(false);
    }, [scanning]);

    // モード切り替え時の処理
    useEffect(() => {
        if (mode === 'scan') {
            void startScanner();
        } else {
            void stopScanner();
        }

        return () => {
            void stopScanner();
        };
    }, [mode, startScanner, stopScanner]);

    // クリーンアップ
    useEffect(() => {
        return () => {
            void stopScanner();
        };
    }, [stopScanner]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">QRコードで連絡先追加</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* モード切り替え */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setMode('show')}
                        className={`flex-1 py-2 rounded ${mode === 'show'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                    >
                        QRコード表示
                    </button>
                    <button
                        onClick={() => setMode('scan')}
                        className={`flex-1 py-2 rounded ${mode === 'scan'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                    >
                        QRコード読み取り
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                        {success}
                    </div>
                )}

                {mode === 'show' ? (
                    <div className="flex flex-col items-center">
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                            <QRCodeSVG value={qrData} size={256} level="H" />
                        </div>
                        <p className="mt-4 text-sm text-gray-600 text-center">
                            このQRコードを相手に読み取ってもらってください
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">
                        <div id={scannerDivId} className="w-full" />
                        {!scanning && !error && (
                            <div className="mt-4 text-center text-gray-600">
                                カメラを起動しています...
                            </div>
                        )}
                        {scanning && (
                            <p className="mt-4 text-sm text-gray-600 text-center">
                                相手のQRコードをカメラに映してください
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-6 text-xs text-gray-500 text-center">
                    <p>💡 相手がQRコードを読み取ると、相手に通知が届きます</p>
                    <p className="mt-1">相手が承認すると、連絡先に追加されます</p>
                </div>
            </div>
        </div>
    );
}
