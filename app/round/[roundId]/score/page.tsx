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
      if (data.parByHole) {
        setParByHole(data.parByHole);
      } else {
        setParByHole(Array(data.holes).fill(4));
      }
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
      <Link href={`/round/${roundId}`} style={{ color: '#2a8c3a' }} className="underline">Terug naar leaderboard</Link>
    </main>
  );

  if (!round) return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <p style={{ color: '#4a664a' }} className="animate-pulse text-sm">Laden...</p>
    </main>
  );

  if (round.status === 'finished') return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
      <p style={{ color: '#c9a227' }} className="text-lg font-semibold">Dit rondje is afgesloten.</p>
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold shrink-0 transition-colors"
          style={{ background: '#141f14', border: '1px solid #263326', color: '#6a8e6a' }}
        >
          ← Leaderboard
        </Link>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-semibold truncate">{round.courseName}</p>
          {round.location && (
            <p className="text-xs truncate" style={{ color: '#4a664a' }}>📍 {round.location}</p>
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
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={groupIndex === i
                ? { background: '#2a8c3a', color: '#fff' }
                : { background: '#141f14', border: '1px solid #263326', color: '#6a8e6a' }
              }
            >
              Groep {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Scorekaart */}
      <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid #222e22' }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: `${100 + activePlayers.length * 72}px` }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#1c2b1c' }}>
              <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide w-10"
                  style={{ color: '#4a664a' }}>Hole</th>
              <th className="text-center px-2 py-3 font-semibold text-xs uppercase tracking-wide w-12"
                  style={{ color: '#4a664a' }}>Par</th>
              {activePlayers.map((p) => (
                <th key={p.id} className="text-center px-1 py-3 font-semibold text-xs">
                  <div className="truncate max-w-[72px] mx-auto" style={{ color: '#e4ebe4' }}>
                    {p.name.split(' ')[0]}
                  </div>
                  {p.handicap > 0 && (
                    <div className="text-[10px] font-normal mt-0.5" style={{ color: '#4a664a' }}>HCP {p.handicap}</div>
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
                <tr key={hole} style={{ borderTop: '1px solid #1a2a1a', background: i % 2 === 0 ? '#0d150d' : '#141f14' }}>
                  <td className="px-3 py-1 font-bold text-sm" style={{ color: '#7a9c7a' }}>{hole}</td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={8}
                      className="w-11 h-10 rounded-lg text-center text-sm font-semibold focus:outline-none focus:ring-1"
                      style={{
                        background: '#1c2b1c',
                        border: '1px solid #2e422e',
                        color: '#e4ebe4',
                        WebkitAppearance: 'none',
                        MozAppearance: 'textfield',
                      }}
                      value={par ?? ''}
                      onChange={(e) => setPar(i, e.target.value)}
                      placeholder="4"
                    />
                  </td>
                  {activePlayers.map((p) => {
                    const score = allScores[p.id]?.[i] ?? null;
                    const diff = score !== null ? score - par : null;
                    const cellBg = diff === null ? undefined
                      : diff <= -2 ? '#0a1e3a'
                      : diff === -1 ? '#0f2840'
                      : diff === 0 ? '#0d1a0d'
                      : diff === 1 ? '#251508'
                      : '#220808';
                    const textColor = diff === null ? '#e4ebe4'
                      : diff <= -1 ? '#60a5fa'
                      : diff === 0 ? '#7ac87a'
                      : diff === 1 ? '#e8521a'
                      : '#ef4444';
                    return (
                      <td key={p.id} className="px-1 py-1 text-center" style={{ background: cellBg }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={20}
                          className="w-14 h-11 rounded-xl text-center text-base font-bold focus:outline-none focus:ring-1"
                          style={{
                            background: 'transparent',
                            border: `1px solid ${diff !== null ? 'transparent' : '#263326'}`,
                            color: textColor,
                            WebkitAppearance: 'none',
                            MozAppearance: 'textfield',
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
            <tr style={{ borderTop: '2px solid #263326', background: '#1c2b1c' }}>
              <td className="px-3 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: '#4a664a' }} colSpan={2}>Totaal</td>
              {activePlayers.map((p) => {
                const total = (allScores[p.id] ?? []).filter((s): s is number => s !== null).reduce((a, b) => a + b, 0);
                const played = (allScores[p.id] ?? []).filter(s => s !== null).length;
                return (
                  <td key={p.id} className="px-1 py-3 text-center font-bold text-base" style={{ color: '#c9a227' }}>
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
        <button onClick={save} disabled={saving}
          className="w-full rounded-xl px-6 py-4 font-bold text-white text-sm transition-all shadow-2xl"
          style={{ background: saved ? '#1e6e2e' : '#2a8c3a' }}>
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen!' : '💾 Scores opslaan'}
        </button>
      </div>
    </main>
  );
}
