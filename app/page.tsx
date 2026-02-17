'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/chat');
  }, [router]);

  return (
    <main className="flex h-screen items-center justify-center bg-gray-100">
      <div className="text-xl font-bold">リダイレクト中...</div>
    </main>
  );
}
