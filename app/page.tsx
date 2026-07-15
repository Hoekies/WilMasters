'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 3000;

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
          style={{ background: '#0d150d' }}>

      <div className="mb-10">
        <Image
          src="/logo.png"
          alt="Willemien's Masters"
          width={200}
          height={174}
          priority
          className="drop-shadow-2xl"
        />
      </div>

      <div className="w-56 h-0.5 rounded-full overflow-hidden" style={{ background: '#1c2b1c' }}>
        <div
          className="h-full transition-all duration-100"
          style={{
            background: 'linear-gradient(90deg, #2a8c3a, #c9a227)',
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-6 text-xs text-center tracking-widest uppercase" style={{ color: '#4a664a' }}>
        Laden
      </div>
    </main>
  );
}
