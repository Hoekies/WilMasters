'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 4000; // 4 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const percent = (remaining / duration) * 100;
      setProgress(percent);

      if (elapsed >= duration) {
        clearInterval(interval);
        router.push('/home');
      }
    }, 50);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-full"
          style={{ background: '#2c4530' }}>

      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/logo.png"
          alt="Willemien's Masters"
          width={200}
          height={200}
          priority
          className="drop-shadow-2xl"
        />
      </div>

      {/* Progress bar */}
      <div className="w-64 h-1 rounded-full overflow-hidden" style={{ background: '#1a2a1a' }}>
        <div
          className="h-full transition-all duration-100"
          style={{
            background: '#2e8c3e',
            width: `${progress}%`,
          }}
        />
      </div>

      {/* Timer text */}
      <div className="mt-8 text-sm text-center" style={{ color: '#6a8870' }}>
        Laden... {Math.ceil(progress / 100 * 4)}s
      </div>
    </main>
  );
}
