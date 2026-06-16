'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Player, Round } from '@/lib/types';
import Image from 'next/image';
import WhatsAppIcon from '@/components/WhatsAppIcon';


function generateId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScoringInfo, setShowScoringInfo] = useState(false);

  const [courseName, setCourseName] = useState('');
  const [courseLocation, setCourseLocation] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [holes, setHoles] = useState<9 | 18>(18);
  const [scoringSystem, setScoringSystem] = useState<'strokeplay' | 'stableford'>('strokeplay');
  const [playerRows, setPlayerRows] = useState<{ name: string; handicap: string }[]>([
    { name: '', handicap: '0' },
  ]);
  const [joinCode, setJoinCode] = useState('');
  const [knownCourses, setKnownCourses] = useState<string[]>([]);
  const [knownPlayers, setKnownPlayers] = useState<string[]>([]);

  useEffect(() => {
    async function loadSuggestions() {
      const snap = await getDocs(collection(db, 'rounds'));
      const courses = new Set<string>();
      const players = new Set<string>();
      snap.docs.forEach((d) => {
        const r = d.data() as Round;
        if (r.courseName) courses.add(r.courseName.trim());
        r.players?.forEach((p) => { if (p.name) players.add(p.name.trim()); });
      });
      setKnownCourses(Array.from(courses).sort());
      setKnownPlayers(Array.from(players).sort());
    }
    loadSuggestions();
  }, []);

  function addPlayer() {
    setPlayerRows((rows) => [...rows, { name: '', handicap: '0' }]);
  }

  function removePlayer(index: number) {
    setPlayerRows((rows) => rows.filter((_, i) => i !== index));
  }

  async function detectLocationByGPS() {
    if (!navigator.geolocation) return setError('GPS niet beschikbaar op dit apparaat.');
    setGpsLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'nl' } }
          );
          const data = await res.json();
          const place =
            data.address?.golf_course ||
            data.address?.leisure ||
            data.address?.suburb ||
            data.address?.village ||
            data.address?.town ||
            data.address?.city ||
            '';
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.municipality ||
            '';
          if (place && !courseName) setCourseName(place);
          if (city) setCourseLocation(city);
        } catch {
          setError('Locatie ophalen mislukt.');
        }
        setGpsLoading(false);
      },
      () => { setError('GPS toegang geweigerd.'); setGpsLoading(false); },
      { timeout: 8000 }
    );
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
      location: courseLocation.trim() || undefined,
      holes,
      scoringSystem,
      createdAt: Date.now(),
      status: 'active',
      players,
    };

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      const docRef = await Promise.race([
        addDoc(collection(db, 'rounds'), round),
        timeoutPromise as Promise<any>
      ]);
      router.push(`/round/${docRef.id}`);
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('Rondje starten error:', message, err);
      if (message === 'Request timeout') {
        setError('Verbinding traag (30s timeout). Controleer internet. Probeer opnieuw.');
      } else if (message.includes('permission-denied')) {
        setError('Geen toegang tot database. Controleer Firebase setup.');
      } else {
        setError(`Fout: ${message}`);
      }
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

  const [appUrl, setAppUrl] = useState('');
  useEffect(() => { setAppUrl(window.location.origin); }, []);
  const waText = encodeURIComponent(`Speel mee met de Willemien's Masters! 🏌️⛳\n${appUrl}`);

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden items-center">

      {/* Vaste header: logo + tabs */}
      <div className="shrink-0 flex flex-col items-center w-full max-w-lg px-4 pt-6 pb-0">
        <Image
          src="/logo-breed.png"
          alt="Willemien's Masters"
          width={600}
          height={180}
          priority
          className="drop-shadow-xl mb-3 h-auto"
          style={{ width: '80%', maxWidth: '360px' }}
        />
        <div className="flex gap-2 w-full mb-2">
          {/* Tabs */}
          <div className="flex rounded-2xl overflow-hidden flex-1 min-w-0"
               style={{ border: '1px solid #263326' }}>
            {(['create', 'join'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`py-2.5 text-sm font-semibold transition-all ${
                  tab === t ? 'text-white' : ''
                }`}
                style={{
                  flex: t === 'create' ? 2 : 1,
                  ...(tab === t
                    ? { background: '#2a8c3a', color: '#fff' }
                    : { color: '#6a8e6a' })
                }}
              >
                {t === 'create' ? '⛳ Nieuw rondje' : '🔗 Doe mee'}
              </button>
            ))}
          </div>
          {/* Agenda icoon */}
          <a href="/agenda"
            className="flex items-center justify-center rounded-2xl px-3 shrink-0 transition-colors"
            style={{ background: '#141f14', border: '1px solid #263326', color: '#e4ebe4' }}
            title="Agenda"
          >
            <span className="text-xl">📅</span>
          </a>
          {/* WhatsApp icoon */}
          <a href={`https://wa.me/?text=${waText}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center rounded-2xl px-3 shrink-0"
            style={{ background: '#25D366', color: '#fff' }}
            title="Deel via WhatsApp"
          >
            <WhatsAppIcon size={20} />
          </a>
        </div>
      </div>

      {/* Scrollbaar formulier */}
      <div className="flex-1 min-h-0 overflow-y-auto w-full">
        <div className="w-full max-w-lg mx-auto px-4 flex flex-col gap-2.5 py-2">
        {tab === 'create' ? (
          <>
            {/* Golfbaan sectie */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a664a' }}>Golfbaan</p>

              <div className="relative">
                <input
                  className="input pr-12"
                  placeholder="Naam van de golfbaan"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  list="course-suggestions"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={detectLocationByGPS}
                  disabled={gpsLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-base w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                  style={{ color: gpsLoading ? '#4a664a' : '#2a8c3a' }}
                  title="GPS gebruiken"
                >
                  {gpsLoading ? '⏳' : '📍'}
                </button>
                {knownCourses.length > 0 && (
                  <datalist id="course-suggestions">
                    {knownCourses.map((c) => <option key={c} value={c} />)}
                  </datalist>
                )}
              </div>

              <input
                className="input"
                placeholder="Plaats"
                value={courseLocation}
                onChange={(e) => setCourseLocation(e.target.value)}
              />
            </div>

            {/* Holes + Systeem */}
            <div className="grid grid-cols-2 gap-2">
              <select className="input" value={holes} onChange={(e) => setHoles(Number(e.target.value) as 9 | 18)}>
                <option value={18}>18 holes</option>
                <option value={9}>9 holes</option>
              </select>
              <div className="flex gap-1">
                <select className="input flex-1" value={scoringSystem} onChange={(e) => setScoringSystem(e.target.value as 'strokeplay' | 'stableford')}>
                  <option value="strokeplay">Strokeplay</option>
                  <option value="stableford">Stableford</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowScoringInfo((v) => !v)}
                  className="w-10 rounded-xl text-sm font-bold shrink-0"
                  style={{
                    background: showScoringInfo ? '#2a8c3a' : '#141f14',
                    border: '1px solid #263326',
                    color: showScoringInfo ? '#fff' : '#6a8e6a'
                  }}
                >?</button>
              </div>
            </div>

            {showScoringInfo && (
              <div className="rounded-xl px-3 py-2.5 text-xs flex flex-col gap-1.5 leading-relaxed"
                   style={{ background: '#141f14', border: '1px solid #263326', color: '#6a8e6a' }}>
                <div><span className="font-semibold" style={{ color: '#c9a227' }}>Stableford</span> — punten per hole op basis van handicap. Hoge score wint.</div>
                <div><span className="font-semibold" style={{ color: '#e8521a' }}>Strokeplay</span> — slagen tellen over alle holes. Lage score wint.</div>
              </div>
            )}

            {/* Spelers */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a664a' }}>
                  Spelers{scoringSystem === 'stableford' && <span style={{ color: '#2e422e' }}> · handicap</span>}
                </p>
              </div>
              {knownPlayers.length > 0 && (
                <datalist id="player-suggestions">
                  {knownPlayers.map((p) => <option key={p} value={p} />)}
                </datalist>
              )}
              {playerRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center rounded-xl px-3 py-2.5"
                     style={{ background: '#1c2b1c', border: '1px solid #2e422e' }}>
                  <span className="text-xs font-bold w-4 shrink-0 text-center" style={{ color: '#2a8c3a' }}>{i + 1}</span>
                  <input
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                    placeholder={`Speler ${i + 1}`}
                    value={row.name}
                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                    list="player-suggestions"
                    autoComplete="off"
                    style={{ color: '#e4ebe4' }}
                  />
                  {scoringSystem === 'stableford' && (
                    <input
                      className="w-12 bg-transparent text-center text-sm focus:outline-none rounded-lg py-0.5"
                      style={{ border: '1px solid #2e422e', color: '#e4ebe4' }}
                      placeholder="HCP"
                      type="number" min={0} max={54}
                      value={row.handicap}
                      onChange={(e) => updatePlayer(i, 'handicap', e.target.value)}
                    />
                  )}
                  {playerRows.length > 1 && (
                    <button onClick={() => removePlayer(i)} className="text-lg leading-none w-5 shrink-0" style={{ color: '#4a664a' }}>×</button>
                  )}
                </div>
              ))}
              {playerRows.length < 30 && (
                <button onClick={addPlayer}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: '#141f14', border: '1px solid #263326', color: '#7a9c7a' }}>
                  <span className="text-base leading-none">+</span> Speler
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a664a' }}>Rondje-code</p>
              <input
                className="input text-center text-2xl tracking-[0.3em] uppercase font-bold"
                placeholder="ABCDEF"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-center mt-1" style={{ color: '#4a664a' }}>
                Vraag de code bij de score-invoerder of scan de QR-code.
              </p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Vaste actieknoppen onderaan */}
      <div className="shrink-0 w-full max-w-lg px-4 pb-4 pt-2.5 flex flex-col gap-2"
           style={{ borderTop: '1px solid #1a2a1a' }}>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {tab === 'create' ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={createRound}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold text-sm transition-all disabled:opacity-40"
              style={{ background: '#2a8c3a', color: '#fff' }}
            >
              <span className="text-2xl leading-none shrink-0">{loading ? '⏳' : '🏌️'}</span>
              <span className="text-xs leading-tight">{loading ? '...' : 'Rondje starten'}</span>
            </button>
            <a
              href="/history"
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 font-semibold text-sm"
              style={{ background: '#1c1608', border: '1px solid #5a4010', color: '#c9a227' }}
            >
              <span className="text-2xl leading-none shrink-0">🏆</span>
              <span className="text-xs leading-tight">Voorgaande edities</span>
            </a>
          </div>
        ) : (
          <button onClick={joinRound} disabled={loading} className="btn-primary">
            {loading ? 'Zoeken...' : 'Naar leaderboard 🏆'}
          </button>
        )}
      </div>

    </main>
  );
}
