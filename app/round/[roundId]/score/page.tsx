'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round, Player } from '@/lib/types';
import { getParForHole } from '@/lib/scoring';
import Link from 'next/link';

export default function ScorePage() {
  const { roundId } = useParams<{ roundId: string }>();
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [draftScores, setDraftScores] = useState<(number | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rounds', roundId), (snap) => {
      if (!snap.exists()) { setError('Rondje niet gevonden.'); return; }
      const data = { id: snap.id, ...snap.data() } as Round;
      setRound(data);
      if (!selectedPlayerId && data.players.length > 0) {
        setSelectedPlayerId(data.players[0].id);
      }
    });
    return unsub;
  }, [roundId]);

  useEffect(() => {
    if (!round || !selectedPlayerId) return;
    const player = round.players.find((p) => p.id === selectedPlayerId);
    if (player) setDraftScores([...player.scores]);
  }, [selectedPlayerId, round?.players]);

  function setScore(holeIndex: number, value: string) {
    const num = parseInt(value);
    setDraftScores((prev) => {
      const next = [...prev];
      next[holeIndex] = isNaN(num) || num < 1 ? null : Math.min(num, 20);
      return next;
    });
  }

  async function save() {
    if (!round || !selectedPlayerId) return;
    setSaving(true);
    try {
      const updatedPlayers = round.players.map((p) =>
        p.id === selectedPlayerId ? { ...p, scores: draftScores } : p
      );
      await updateDoc(doc(db, 'rounds', roundId), { players: updatedPlayers });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Opslaan mislukt.');
    }
    setSaving(false);
  }

  if (error) return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p className="text-red-400">{error}</p>
      <Link href={`/round/${roundId}`} className="text-green-400 underline">Terug naar leaderboard</Link>
    </main>
  );

  if (!round) return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-green-300 animate-pulse">Laden...</p>
    </main>
  );

  if (round.status === 'finished') return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p className="text-yellow-400 text-lg">Dit rondje is afgesloten.</p>
      <Link href={`/round/${roundId}`} className="btn-primary text-center">Naar leaderboard</Link>
    </main>
  );

  const selectedPlayer = round.players.find((p) => p.id === selectedPlayerId);

  return (
    <main className="flex flex-col min-h-screen px-4 py-6 gap-5 max-w-lg mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link href={`/round/${roundId}`} className="text-green-400 text-sm">← Leaderboard</Link>
        <div className="flex-1 text-right">
          <span className="text-sm text-green-400">{round.courseName}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-green-300">Speler</label>
        <select
          className="input"
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
        >
          {round.players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}{p.handicap > 0 ? ` (HCP ${p.handicap})` : ''}</option>
          ))}
        </select>
      </div>

      {selectedPlayer && draftScores.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[3rem_1fr_4rem_4rem] gap-x-3 gap-y-2 text-xs text-green-400 px-1">
            <span>Hole</span><span>Par</span><span>Score</span><span>Saldo</span>
          </div>
          {Array.from({ length: round.holes }, (_, i) => {
            const hole = i + 1;
            const par = getParForHole(hole);
            const score = draftScores[i];
            const diff = score !== null ? score - par : null;
            return (
              <div key={hole} className="grid grid-cols-[3rem_1fr_4rem_4rem] gap-x-3 items-center bg-green-900/30 rounded-lg px-3 py-2 border border-green-800">
                <span className="font-bold text-sm">{hole}</span>
                <span className="text-sm text-green-400">{par}</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="input text-center py-1 px-1 text-sm"
                  value={score ?? ''}
                  onChange={(e) => setScore(i, e.target.value)}
                  placeholder="—"
                />
                <span className={`text-sm text-center font-medium ${diff === null ? 'text-green-600' : diff < 0 ? 'text-blue-400' : diff === 0 ? 'text-green-300' : diff === 1 ? 'text-orange-400' : 'text-red-400'}`}>
                  {diff === null ? '—' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 mt-auto pt-4 border-t border-green-800 sticky bottom-4">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary flex-1"
        >
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen!' : 'Scores opslaan'}
        </button>
      </div>
    </main>
  );
}
