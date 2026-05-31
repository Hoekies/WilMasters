'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round } from '@/lib/types';
import { getParForHole } from '@/lib/scoring';
import Link from 'next/link';

export default function ScorePage() {
  const { roundId } = useParams<{ roundId: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [allScores, setAllScores] = useState<Record<string, (number | null)[]>>({});
  const [parByHole, setParByHole] = useState<(number | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [groupIndex, setGroupIndex] = useState(0);

  const GROUP_SIZE = 5;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rounds', roundId), (snap) => {
      if (!snap.exists()) { setError('Rondje niet gevonden.'); return; }
      const data = { id: snap.id, ...snap.data() } as Round;
      setRound(data);
      // Initialiseer par
      if (data.parByHole) {
        setParByHole(data.parByHole);
      } else {
        // Default: alle holes par 4
        setParByHole(Array(data.holes).fill(4));
      }
      // Initialiseer scores alleen als ze nog niet gezet zijn
      setAllScores((prev) => {
        const next = { ...prev };
        data.players.forEach((p) => {
          if (!next[p.id]) next[p.id] = [...p.scores];
        });
        return next;
      });
    });
    return unsub;
  }, [roundId]);

  function setScore(playerId: string, holeIndex: number, value: string) {
    const num = parseInt(value);
    setAllScores((prev) => ({
      ...prev,
      [playerId]: prev[playerId].map((s, i) =>
        i === holeIndex ? (isNaN(num) || num < 1 ? null : Math.min(num, 20)) : s
      ),
    }));
  }

  function setPar(holeIndex: number, value: string) {
    const num = parseInt(value);
    setParByHole((prev) => prev.map((p, i) =>
      i === holeIndex ? (isNaN(num) || num < 3 ? null : Math.min(num, 8)) : p
    ));
  }

  async function save() {
    if (!round) return;
    setSaving(true);
    try {
      const updatedPlayers = round.players.map((p) => ({
        ...p,
        scores: allScores[p.id] ?? p.scores,
      }));
      await updateDoc(doc(db, 'rounds', roundId), {
        players: updatedPlayers,
        parByHole: parByHole,
      });
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
      <Link href={`/round/${roundId}`} style={{ color: '#2e8c3e' }} className="underline">Terug naar leaderboard</Link>
    </main>
  );

  if (!round) return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <p style={{ color: '#6a8870' }} className="animate-pulse text-sm">Laden...</p>
    </main>
  );

  if (round.status === 'finished') return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p style={{ color: '#f5c842' }} className="text-lg font-semibold">Dit rondje is afgesloten.</p>
      <Link href={`/round/${roundId}`} className="btn-primary text-center max-w-xs">Naar leaderboard</Link>
    </main>
  );

  const groups: typeof round.players[] = [];
  for (let i = 0; i < round.players.length; i += GROUP_SIZE) {
    groups.push(round.players.slice(i, i + GROUP_SIZE));
  }
  const activePlayers = groups[groupIndex] ?? [];

  return (
    <main className="flex flex-col min-h-screen px-3 py-5 gap-4 w-full max-w-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <Link
          href={`/round/${roundId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold shrink-0 transition-colors"
          style={{ background: 'rgba(0,0,0,0.15)',border: '1px solid #243028', color: '#6a8870' }}
        >
          ← Leaderboard
        </Link>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-semibold truncate">{round.courseName}</p>
          {round.location && (
            <p className="text-xs truncate" style={{ color: '#4a6450' }}>📍 {round.location}</p>
          )}
        </div>
      </div>

      {/* Groep-selector (alleen bij >5 spelers) */}
      {groups.length > 1 && (
        <div className="flex gap-2 px-1">
          {groups.map((_, i) => (
            <button
              key={i}
              onClick={() => setGroupIndex(i)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={groupIndex === i
                ? { background: '#2e8c3e', color: '#fff' }
                : { background: '#2c4530', border: '1px solid #243028', color: '#6a8870' }
              }
            >
              Groep {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Scorekaart */}
      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid #243028' }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${120 + activePlayers.length * 64}px` }}>
          <thead>
            <tr style={{ background: '#2c4530' }}>
              <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide w-12"
                  style={{ color: '#4a6450' }}>Hole</th>
              <th className="text-center px-2 py-2.5 font-semibold text-xs uppercase tracking-wide w-10"
                  style={{ color: '#4a6450' }}>Par</th>
              {activePlayers.map((p) => (
                <th key={p.id} className="text-center px-1 py-2.5 font-semibold text-xs">
                  <div className="truncate max-w-[64px] mx-auto" style={{ color: '#fff' }}>
                    {p.name.split(' ')[0]}
                  </div>
                  {p.handicap > 0 && (
                    <div className="text-[10px] font-normal" style={{ color: '#4a6450' }}>HCP {p.handicap}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: round.holes }, (_, i) => {
              const hole = i + 1;
              const par = parByHole[i] ?? 4;
              return (
                <tr key={hole} style={{ borderTop: '1px solid #1e2c20', background: i % 2 === 0 ? '#161d17' : '#1f3620' }}>
                  <td className="px-3 py-1.5 font-bold text-sm">{hole}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={8}
                      className="w-10 rounded text-center text-sm font-medium py-1 focus:outline-none focus:ring-1"
                      style={{
                        background: '#2c4530',
                        border: '1px solid #243028',
                        color: '#fff',
                        WebkitAppearance: 'none',
                      }}
                      value={par ?? ''}
                      onChange={(e) => setPar(i, e.target.value)}
                      placeholder="4"
                    />
                  </td>
                  {activePlayers.map((p) => {
                    const score = allScores[p.id]?.[i] ?? null;
                    const diff = score !== null ? score - par : null;
                    const cellColor = diff === null ? undefined
                      : diff < 0 ? '#1e3a5f'
                      : diff === 0 ? '#2c4530'
                      : diff === 1 ? '#3a1f0a'
                      : '#3a0a0a';
                    return (
                      <td key={p.id} className="px-1 py-1.5 text-center" style={{ background: cellColor }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          className="w-14 rounded-lg text-center text-sm font-medium py-1.5 focus:outline-none focus:ring-1"
                          style={{
                            background: 'transparent',
                            border: '1px solid #243028',
                            color: '#fff',
                            WebkitAppearance: 'none',
                          }}
                          value={score ?? ''}
                          onChange={(e) => setScore(p.id, i, e.target.value)}
                          placeholder="—"
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Totaalrij */}
            <tr style={{ borderTop: '2px solid #243028', background: '#2c4530' }}>
              <td className="px-3 py-2.5 font-bold text-xs uppercase tracking-wide" style={{ color: '#4a6450' }} colSpan={2}>Totaal</td>
              {activePlayers.map((p) => {
                const total = (allScores[p.id] ?? []).filter((s): s is number => s !== null).reduce((a, b) => a + b, 0);
                const played = (allScores[p.id] ?? []).filter(s => s !== null).length;
                return (
                  <td key={p.id} className="px-1 py-2.5 text-center font-bold text-sm">
                    {played > 0 ? total : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {error && <p className="text-red-400 text-sm text-center px-1">{error}</p>}

      {/* Sticky opslaan */}
      <div className="sticky bottom-4 px-1">
        <button onClick={save} disabled={saving} className="btn-primary shadow-2xl">
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen!' : '💾 Scores opslaan'}
        </button>
      </div>
    </main>
  );
}
