'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Round } from '@/lib/types';
import { buildLeaderboard } from '@/lib/scoring';
import { useAdmin } from '@/lib/useAdmin';
import Image from 'next/image';
import Link from 'next/link';

export default function HistoryPage() {
  const { isAdmin, login } = useAdmin();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<string>('alle');
  const [loginModal, setLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginError, setLoginError] = useState('');

  function doLogin() {
    if (login(loginForm.user, loginForm.pass)) {
      setLoginModal(false); setLoginForm({ user: '', pass: '' }); setLoginError('');
    } else setLoginError('Gebruikersnaam of wachtwoord onjuist.');
  }

  useEffect(() => {
    async function load() {
      const q = query(collection(db, 'rounds'), where('status', '==', 'finished'));
      const snap = await getDocs(q);
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Round)
        .sort((a, b) => (b.finishedAt ?? b.createdAt ?? 0) - (a.finishedAt ?? a.createdAt ?? 0));
      setRounds(data);
      setLoading(false);
    }
    load();
  }, []);

  const courses = ['alle', ...Array.from(new Set(rounds.map((r) => r.courseName)))];
  const filtered = selectedCourse === 'alle' ? rounds : rounds.filter((r) => r.courseName === selectedCourse);

  return (
    <main className="flex flex-col min-h-screen gap-3 max-w-lg mx-auto w-full sm:max-w-xl">

      <Link href="/" className="flex justify-center pt-4 px-4">
        <Image
          src="/logo-breed.png"
          alt="Willemien's Masters"
          width={700}
          height={242}
          className="h-auto drop-shadow-lg"
          style={{ width: '80%', maxWidth: '360px' }}
          priority
        />
      </Link>

      <h1 className="font-bold text-base sm:text-lg text-center px-4">Voorgaande edities</h1>

      {/* Filters */}
      <div className="px-4 flex items-center gap-2 flex-wrap">
        {courses.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCourse(c)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={selectedCourse === c
              ? { background: '#2a8c3a', color: '#fff' }
              : { background: '#141f14', border: '1px solid #263326', color: '#6a8e6a' }
            }
          >
            {c === 'alle' ? 'Alle banen' : c}
          </button>
        ))}
        <div className="flex gap-2 ml-auto shrink-0">
          {!isAdmin && (
            <button onClick={() => setLoginModal(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-sm"
              style={{ background: '#141f14', border: '1px solid #263326', color: '#6a8e6a' }}
              title="Inloggen">🔒</button>
          )}
          <Link
            href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-base transition-colors"
            style={{ background: '#141f14', border: '1px solid #263326' }}
          >
            🏠
          </Link>
        </div>
      </div>

      {loading && (
        <p className="text-center py-10 animate-pulse px-4" style={{ color: '#4a664a' }}>Laden...</p>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-10 px-4" style={{ color: '#4a664a' }}>
          <p className="text-lg mb-2">Nog geen afgesloten rondjes</p>
          <Link href="/" className="text-sm underline" style={{ color: '#2a8c3a' }}>Start een nieuw rondje</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {filtered.map((round) => (
          <RoundCard
            key={round.id}
            round={round}
            allRounds={rounds}
            isAdmin={isAdmin}
            onDelete={(id) => setRounds((prev) => prev.filter((r) => r.id !== id))}
          />
        ))}
      </div>

      {/* Login modal */}
      {loginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
             style={{ background: 'rgba(0,0,0,0.85)' }}
             onClick={(e) => e.target === e.currentTarget && setLoginModal(false)}>
          <div className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
               style={{ background: '#0d150d', border: '1px solid #263326' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Inloggen</h2>
              <button onClick={() => setLoginModal(false)} className="text-2xl" style={{ color: '#4a664a' }}>×</button>
            </div>
            <input className="input" placeholder="Gebruikersnaam" value={loginForm.user}
              onChange={(e) => setLoginForm(f => ({ ...f, user: e.target.value }))} />
            <input className="input" type="password" placeholder="Wachtwoord" value={loginForm.pass}
              onChange={(e) => setLoginForm(f => ({ ...f, pass: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <button onClick={doLogin} className="btn-primary">Inloggen</button>
          </div>
        </div>
      )}
    </main>
  );
}

function RoundCard({
  round,
  allRounds,
  isAdmin,
  onDelete,
}: {
  round: Round;
  allRounds: Round[];
  isAdmin: boolean;
  onDelete: (id: string) => void;
}) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  async function handleDelete() {
    if (!round.id) return;
    if (!confirm(`"${round.courseName}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    await deleteDoc(doc(db, 'rounds', round.id));
    onDelete(round.id);
  }

  const leaderboard = buildLeaderboard(round);

  const date = round.finishedAt
    ? new Date(round.finishedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(round.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

  function getPlayerHistory(playerName: string) {
    return allRounds
      .filter((r) => r.courseName === round.courseName && r.scoringSystem === round.scoringSystem && r.status === 'finished')
      .sort((a, b) => (a.finishedAt ?? a.createdAt) - (b.finishedAt ?? b.createdAt))
      .map((r) => {
        const lb = buildLeaderboard(r);
        const entry = lb.find((e) => e.player.name.toLowerCase() === playerName.toLowerCase());
        if (!entry || entry.holesPlayed === 0) return null;
        const d = r.finishedAt ?? r.createdAt;
        return { date: d, entry, roundId: r.id };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  const medals = ['🏆', '🥈', '🥉'];

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl"
         style={{ background: '#141f14', border: '1px solid #222e22' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm">{round.courseName}</h2>
          <p className="text-xs mt-0.5">
            <span className="font-bold" style={{ color: '#c9a227' }}>{date}</span>
            <span style={{ color: '#4a664a' }}> · {round.holes}h · {round.scoringSystem === 'stableford' ? 'SFD' : 'SP'}</span>
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Link
            href={`/round/${round.id}`}
            className="text-xs px-2 py-1.5 rounded-lg transition-colors"
            style={{ background: '#1c2b1c', border: '1px solid #2e422e', color: '#7a9c7a' }}
          >
            →
          </Link>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="text-xs px-2 py-1.5 rounded-lg transition-colors"
              style={{ border: '1px solid #4a1a0a', color: '#e8521a' }}
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Spelers */}
      <div className="flex flex-col gap-1">
        {leaderboard.map((entry, i) => {
          const isExpanded = expandedPlayer === entry.player.name;
          const history = isExpanded ? getPlayerHistory(entry.player.name) : [];

          return (
            <div key={entry.player.id}>
              <button
                onClick={() => setExpandedPlayer(isExpanded ? null : entry.player.name)}
                className="w-full flex items-center gap-2 text-sm rounded-xl px-2.5 py-2 transition-colors text-left"
                style={{
                  background: isExpanded ? '#0d1a0d' : '#1c2b1c',
                  border: `1px solid ${isExpanded ? '#2a8c3a' : '#1e2a1e'}`,
                }}
              >
                <span className="text-base w-5 shrink-0 text-center">{i < 3 ? medals[i] : i + 1}</span>
                <span className="flex-1 font-medium truncate text-xs">{entry.player.name}</span>
                {round.scoringSystem === 'stableford' ? (
                  <span className="font-bold text-xs shrink-0" style={{ color: i === 0 ? '#c9a227' : '#e4ebe4' }}>
                    {entry.stablefordPoints} <span className="font-normal" style={{ color: '#4a664a' }}>pt</span>
                  </span>
                ) : (
                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs" style={{ color: i === 0 ? '#c9a227' : '#e4ebe4' }}>{entry.totalStrokes}</span>
                    <span className="text-[10px] ml-1" style={{
                      color: entry.toPar < 0 ? '#60a5fa' : entry.toPar === 0 ? '#6a8e6a' : '#e8521a'
                    }}>
                      ({entry.toPar === 0 ? 'E' : entry.toPar > 0 ? `+${entry.toPar}` : entry.toPar})
                    </span>
                  </div>
                )}
                <span className="text-[10px] shrink-0" style={{ color: '#4a664a' }}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="mt-1 ml-7 rounded-xl overflow-hidden" style={{ border: '1px solid #222e22' }}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                       style={{ background: '#1c2b1c', color: '#4a664a' }}>
                    Vooruitgang · {round.courseName}
                  </div>
                  {history.map((h, idx) => {
                    const prev = idx > 0 ? history[idx - 1] : null;
                    let delta: number | null = null;
                    let improved: boolean | null = null;
                    if (prev) {
                      if (round.scoringSystem === 'stableford') {
                        delta = h.entry.stablefordPoints - prev.entry.stablefordPoints;
                        improved = delta > 0;
                      } else {
                        delta = h.entry.totalStrokes - prev.entry.totalStrokes;
                        improved = delta < 0;
                      }
                    }
                    const d = new Date(h.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
                    const isThisRound = h.roundId === round.id;

                    return (
                      <div
                        key={h.roundId}
                        className="flex items-center gap-2 px-3 py-2 text-xs"
                        style={{
                          background: isThisRound ? '#0d150d' : '#141f14',
                          borderTop: idx > 0 ? '1px solid #1a2a1a' : undefined,
                        }}
                      >
                        <span className="flex-1" style={{ color: isThisRound ? '#e4ebe4' : '#6a8e6a' }}>{d}</span>
                        {round.scoringSystem === 'stableford' ? (
                          <span className="font-bold" style={{ color: isThisRound ? '#c9a227' : '#e4ebe4' }}>
                            {h.entry.stablefordPoints} pt
                          </span>
                        ) : (
                          <span className="font-bold" style={{ color: isThisRound ? '#c9a227' : '#e4ebe4' }}>
                            {h.entry.totalStrokes}
                            <span className="text-[10px] font-normal ml-1" style={{ color: '#4a664a' }}>
                              ({h.entry.toPar === 0 ? 'E' : h.entry.toPar > 0 ? `+${h.entry.toPar}` : h.entry.toPar})
                            </span>
                          </span>
                        )}
                        {delta !== null && improved !== null && (
                          <span className="text-[10px] font-semibold w-14 text-right" style={{ color: improved ? '#4ade80' : '#f87171' }}>
                            {improved ? '▲' : '▼'} {Math.abs(delta)}
                          </span>
                        )}
                        {delta === null && <span className="w-14" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
