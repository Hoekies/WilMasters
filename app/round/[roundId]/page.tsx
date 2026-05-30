'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round, LeaderboardEntry } from '@/lib/types';
import { buildLeaderboard } from '@/lib/scoring';
import Image from 'next/image';
import Link from 'next/link';

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
    await updateDoc(doc(db, 'rounds', roundId), { status: 'finished' });
    setFinishing(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p className="text-red-400">{error}</p>
      <Link href="/" className="text-green-400 underline">Terug</Link>
    </main>
  );

  if (!round) return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-green-300 animate-pulse">Laden...</p>
    </main>
  );

  return (
    <main className="flex flex-col min-h-screen px-4 py-6 gap-5 max-w-lg mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/">
          <Image src="/logo.png" alt="Logo" width={36} height={36} />
        </Link>
        <div className="flex-1">
          <h1 className="font-bold text-lg leading-tight">{round.courseName}</h1>
          <p className="text-green-400 text-xs">
            {round.holes} holes · {round.scoringSystem === 'stableford' ? 'Stableford' : 'Strokeplay'} ·{' '}
            {round.status === 'finished' ? '✓ Afgerond' : 'Live'}
          </p>
        </div>
        <span className="text-xs bg-green-800 px-2 py-1 rounded font-mono">{roundId}</span>
      </div>

      {/* Leaderboard */}
      <div className="flex flex-col gap-2">
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.player.id}
            entry={entry}
            scoringSystem={round.scoringSystem}
            isFirst={index === 0 && entry.holesPlayed > 0}
          />
        ))}
      </div>

      {/* Actions */}
      {round.status === 'active' && (
        <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-green-800">
          <Link
            href={`/round/${roundId}/score`}
            className="btn-primary text-center"
          >
            Scores invoeren
          </Link>
          <div className="flex gap-2">
            <button onClick={copyLink} className="btn-secondary flex-1">
              {copied ? '✓ Gekopieerd!' : 'Link kopiëren'}
            </button>
            <button
              onClick={finishRound}
              disabled={finishing}
              className="btn-secondary flex-1 text-orange-400 border-orange-800 hover:bg-orange-950"
            >
              Afsluiten
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function LeaderboardRow({
  entry,
  scoringSystem,
  isFirst,
}: {
  entry: LeaderboardEntry;
  scoringSystem: 'strokeplay' | 'stableford';
  isFirst: boolean;
}) {
  const { player, position, totalStrokes, stablefordPoints, holesPlayed, toPar } = entry;
  const hasScores = holesPlayed > 0;

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${isFirst ? 'bg-yellow-900/40 border border-yellow-700' : 'bg-green-900/30 border border-green-800'}`}>
      <span className="w-6 text-center font-bold text-sm text-green-400">
        {hasScores ? (position > 0 ? position : '-') : '-'}
      </span>
      <span className="flex-1 font-medium">{player.name}</span>
      {player.handicap > 0 && (
        <span className="text-xs text-green-500 mr-1">HCP {player.handicap}</span>
      )}
      <div className="text-right">
        {scoringSystem === 'stableford' ? (
          <span className="font-bold text-yellow-300">{hasScores ? `${stablefordPoints} pt` : '—'}</span>
        ) : (
          <span className="font-bold">{hasScores ? totalStrokes : '—'}</span>
        )}
        {scoringSystem === 'strokeplay' && hasScores && (
          <div className="text-xs text-green-400">{toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}</div>
        )}
      </div>
      <span className="text-xs text-green-500 ml-1">{holesPlayed}/{entry.player.scores.length}</span>
    </div>
  );
}
