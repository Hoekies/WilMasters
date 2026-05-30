'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Player, Round } from '@/lib/types';
import Image from 'next/image';

function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create form state
  const [courseName, setCourseName] = useState('');
  const [holes, setHoles] = useState<9 | 18>(18);
  const [scoringSystem, setScoringSystem] = useState<'strokeplay' | 'stableford'>('stableford');
  const [playerRows, setPlayerRows] = useState<{ name: string; handicap: string }[]>([
    { name: '', handicap: '0' },
  ]);

  // Join form state
  const [joinCode, setJoinCode] = useState('');

  function addPlayer() {
    setPlayerRows((rows) => [...rows, { name: '', handicap: '0' }]);
  }

  function removePlayer(index: number) {
    setPlayerRows((rows) => rows.filter((_, i) => i !== index));
  }

  function updatePlayer(index: number, field: 'name' | 'handicap', value: string) {
    setPlayerRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function createRound() {
    const validPlayers = playerRows.filter((r) => r.name.trim());
    if (!courseName.trim()) return setError('Vul een baannaam in.');
    if (validPlayers.length === 0) return setError('Voeg minimaal één speler toe.');
    if (validPlayers.length > 30) return setError('Maximaal 30 spelers.');

    setLoading(true);
    setError('');

    const players: Player[] = validPlayers.map((r) => ({
      id: generateId(),
      name: r.name.trim(),
      handicap: Math.max(0, parseInt(r.handicap) || 0),
      scores: Array(holes).fill(null),
    }));

    const round: Round = {
      courseName: courseName.trim(),
      holes,
      scoringSystem,
      createdAt: Date.now(),
      status: 'active',
      players,
    };

    try {
      const docRef = await addDoc(collection(db, 'rounds'), round);
      router.push(`/round/${docRef.id}`);
    } catch {
      setError('Verbindingsfout. Controleer je Firebase-configuratie.');
      setLoading(false);
    }
  }

  async function joinRound() {
    const code = joinCode.trim();
    if (!code) return setError('Vul een rondje-code in.');
    setLoading(true);
    setError('');
    try {
      const snap = await getDoc(doc(db, 'rounds', code));
      if (!snap.exists()) {
        setError('Rondje niet gevonden. Controleer de code.');
        setLoading(false);
        return;
      }
      router.push(`/round/${code}`);
    } catch {
      setError('Verbindingsfout.');
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center min-h-screen px-4 py-8 gap-6">
      <div className="flex flex-col items-center gap-2 mb-2">
        <Image src="/logo.png" alt="Golf z'n Loatst" width={80} height={80} priority />
        <h1 className="text-2xl font-bold tracking-tight">Golf z&apos;n Loatst</h1>
        <p className="text-green-300 text-sm">Live scores voor kleine groepen</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-green-700 w-full max-w-md">
        {(['create', 'join'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t ? 'bg-green-600 text-white' : 'text-green-300 hover:bg-green-900'
            }`}
          >
            {t === 'create' ? 'Nieuw rondje' : 'Doe mee'}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md flex flex-col gap-4">
        {tab === 'create' ? (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-green-300">Golfbaan</label>
              <input
                className="input"
                placeholder="Naam van de golfbaan"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-sm text-green-300">Holes</label>
                <select className="input" value={holes} onChange={(e) => setHoles(Number(e.target.value) as 9 | 18)}>
                  <option value={18}>18 holes</option>
                  <option value={9}>9 holes</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-sm text-green-300">Systeem</label>
                <select className="input" value={scoringSystem} onChange={(e) => setScoringSystem(e.target.value as 'strokeplay' | 'stableford')}>
                  <option value="stableford">Stableford</option>
                  <option value="strokeplay">Strokeplay</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-green-300">Spelers</label>
              {playerRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input flex-1"
                    placeholder={`Naam speler ${i + 1}`}
                    value={row.name}
                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                  />
                  <input
                    className="input w-20 text-center"
                    placeholder="HCP"
                    type="number"
                    min={0}
                    max={54}
                    value={row.handicap}
                    onChange={(e) => updatePlayer(i, 'handicap', e.target.value)}
                  />
                  {playerRows.length > 1 && (
                    <button
                      onClick={() => removePlayer(i)}
                      className="text-green-400 hover:text-red-400 text-xl leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {playerRows.length < 30 && (
                <button
                  onClick={addPlayer}
                  className="text-sm text-green-400 hover:text-green-200 self-start mt-1"
                >
                  + Speler toevoegen
                </button>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={createRound}
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? 'Aanmaken...' : 'Rondje starten'}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-green-300">Rondje-code</label>
              <input
                className="input text-center text-xl tracking-widest uppercase"
                placeholder="ABCDEF"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-green-500">Vraag de code of scan de QR-code bij de score-invoerder.</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={joinRound}
              disabled={loading}
              className="btn-primary mt-2"
            >
              {loading ? 'Zoeken...' : 'Naar leaderboard'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
