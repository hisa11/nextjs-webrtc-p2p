'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const errorMessages: Record<string, string> = {
    Configuration: '認証設定にエラーがあります',
    AccessDenied: 'アクセスが拒否されました',
    Verification: '認証トークンの検証に失敗しました',
    Default: '認証エラーが発生しました',
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-3xl font-bold text-center text-red-600">認証エラー</h2>
          <p className="mt-4 text-center text-gray-600">{errorMessage}</p>
          {error && (
            <p className="mt-2 text-center text-sm text-gray-500">エラーコード: {error}</p>
          )}
        </div>
        <div className="space-y-4">
          <Link
            href="/auth/signin"
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            サインインページに戻る
          </Link>
          <Link
            href="/"
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ホームに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">読み込み中...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
