'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round, LeaderboardEntry } from '@/lib/types';
import { buildLeaderboard } from '@/lib/scoring';
import Image from 'next/image';
import Link from 'next/link';
import WhatsAppIcon from '@/components/WhatsAppIcon';

const MEDAL: Record<number, string> = { 1: '🏆', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/round/${roundId}` : '';

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'rounds', roundId),
      (snap) => {
        if (!snap.exists()) { setError('Rondje niet gevonden.'); return; }
        const data = { id: snap.id, ...snap.data() } as Round;
        setRound(data);
        setLeaderboard(buildLeaderboard(data));
      },
      () => setError('Verbindingsfout.')
    );
    return unsub;
  }, [roundId]);

  async function finishRound() {
    if (!confirm('Rondje afsluiten?')) return;
    setFinishing(true);
    await updateDoc(doc(db, 'rounds', roundId), {
      status: 'finished',
      finishedAt: Date.now(),
    });
    setFinishing(false);
    if (confirm('Rondje afgesloten! Wil je naar het dashboard?')) {
      router.push('/');
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p className="text-red-400">{error}</p>
      <Link href="/" style={{ color: '#2a8c3a' }} className="underline">Terug</Link>
    </main>
  );

  if (!round) return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <p style={{ color: '#4a664a' }} className="animate-pulse text-sm">Laden...</p>
    </main>
  );

  return (
    <main className="flex flex-col min-h-screen gap-4 max-w-lg mx-auto w-full sm:max-w-xl md:max-w-2xl">

      <Link href="/" className="flex justify-center pt-5 px-4">
        <Image
          src="/logo-breed.png"
          alt="Willemien's Masters"
          width={600}
          height={180}
          className="h-auto drop-shadow-lg"
          style={{ width: '80%', maxWidth: '360px' }}
          priority
        />
      </Link>

      {/* Rondje-info */}
      <div className="px-4 flex flex-col items-center text-center gap-1">
        <h1 className="font-bold text-2xl">{round.courseName}</h1>
        {round.location && (
          <p className="text-xs" style={{ color: '#6a8e6a' }}>{round.location}</p>
        )}
        <div className="flex items-center justify-center gap-2 w-full mt-0.5">
          <p className="text-xs" style={{ color: '#6a8e6a' }}>
            {round.holes} holes · {round.scoringSystem === 'stableford' ? 'Stableford' : 'Strokeplay'}
            {round.status === 'finished'
              ? <span style={{ color: '#c9a227' }}> · ✓ Afgerond</span>
              : <span style={{ color: '#2a8c3a' }}> · 🔴 Live</span>}
          </p>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={copyLink}
              className="text-xs font-mono px-2 py-0.5 rounded shrink-0 transition-colors"
              style={{ background: '#141f14', border: '1px solid #263326', color: copied ? '#2a8c3a' : '#6a8e6a' }}
              title="Kopieer link"
            >
              {copied ? '✓' : roundId.slice(0, 8)}
            </button>
            {round.status === 'active' && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Volg live het leaderboard van ${round.courseName}! 🏌️\n${shareUrl}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 rounded shrink-0"
                style={{ background: '#25D366', color: '#fff' }}
                title="Deel via WhatsApp"
              >
                <WhatsAppIcon size={14} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 pb-2 flex flex-col gap-2">
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.player.id}
            entry={entry}
            scoringSystem={round.scoringSystem}
            index={index}
          />
        ))}
      </div>

      {/* Acties */}
      {round.status === 'active' && (
        <div className="flex gap-2 px-4 pb-4 pt-2" style={{ borderTop: '1px solid #1a2a1a' }}>
          <Link
            href={`/round/${roundId}/score`}
            className="flex-1 flex items-center justify-center rounded-xl py-3 text-sm font-semibold"
            style={{ background: '#2a8c3a', color: '#fff' }}
          >
            ✏️ Scores invoeren
          </Link>
          <button
            onClick={finishRound}
            disabled={finishing}
            className="rounded-xl px-4 py-3 text-sm font-medium transition-colors"
            style={{ flex: '0 0 20%', border: '1px solid #4a1a0a', color: '#e8521a' }}
          >
            {finishing ? '...' : '✕'}
          </button>
        </div>
      )}
    </main>
  );
}

function LeaderboardRow({
  entry,
  scoringSystem,
  index,
}: {
  entry: LeaderboardEntry;
  scoringSystem: 'strokeplay' | 'stableford';
  index: number;
}) {
  const { player, position, totalStrokes, stablefordPoints, holesPlayed, toPar } = entry;
  const hasScores = holesPlayed > 0;
  const medal = hasScores && position > 0 ? MEDAL[position] : null;

  const rowStyle =
    position === 1 && hasScores
      ? { background: '#181e08', border: '1px solid #6a5a08' }
      : position === 2 && hasScores
      ? { background: '#12181e', border: '1px solid #4a5a6e' }
      : position === 3 && hasScores
      ? { background: '#1a130a', border: '1px solid #6a4a1e' }
      : { background: '#141f14', border: '1px solid #222e22' };

  const posColor =
    position === 1 ? '#c9a227' :
    position === 2 ? '#a8b8c8' :
    position === 3 ? '#b07040' : '#4a664a';

  const toParColor = toPar < 0 ? '#60a5fa' : toPar === 0 ? '#6a8e6a' : toPar <= 2 ? '#e8521a' : '#ef4444';

  return (
    <div className="flex items-center rounded-2xl px-4 py-3 gap-3" style={rowStyle}>

      <div className="shrink-0 flex flex-col items-center gap-1 w-8">
        {medal
          ? <span className="text-3xl leading-none">{medal}</span>
          : <span className="font-bold text-sm" style={{ color: hasScores ? posColor : '#2a3a2a' }}>
              {hasScores ? position : '—'}
            </span>
        }
      </div>

      <div className="text-center" style={{ flex: '0.7' }}>
        <span className={`font-semibold block ${position === 1 && hasScores ? 'text-base' : 'text-sm'}`}>
          {player.name}
        </span>
        <span className="text-xs" style={{ color: '#4a664a' }}>
          {hasScores ? `${holesPlayed}/${player.scores.length} holes` : 'Nog niet gespeeld'}
          {player.handicap > 0 && ` · HCP ${player.handicap}`}
        </span>
      </div>

      <div className="text-right shrink-0 min-w-[64px]">
        {scoringSystem === 'stableford' ? (
          <>
            <div className="font-bold text-xl leading-tight" style={{ color: position === 1 && hasScores ? '#c9a227' : '#e4ebe4' }}>
              {hasScores ? stablefordPoints : '—'}
            </div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: '#4a664a' }}>punten</div>
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-[10px] uppercase tracking-wide" style={{ color: '#4a664a' }}>slagen</span>
              <span className="font-bold text-xl leading-tight" style={{ color: position === 1 && hasScores ? '#c9a227' : '#e4ebe4' }}>
                {hasScores ? totalStrokes : '—'}
              </span>
            </div>
            {hasScores && (
              <div className="flex items-baseline justify-end gap-1.5">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: '#4a664a' }}>t.o.v. par</span>
                <span className="font-bold text-sm" style={{ color: toParColor }}>
                  {toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
