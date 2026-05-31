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

  const [appUrl, setAppUrl] = useState('');
  useEffect(() => { setAppUrl(window.location.origin); }, []);
  const waText = encodeURIComponent(`Speel mee met de Willemien's Masters! 🏌️⛳\n${appUrl}`);

  return (
    <main className="flex flex-col h-[100dvh] overflow-hidden items-center">

      {/* Vaste header: logo + tabs */}
      <div className="shrink-0 flex flex-col items-center w-full max-w-lg px-4 pt-3 pb-0">
        <Image
          src="/logo-breed.png"
          alt="Willemien's Masters"
          width={600}
          height={180}
          priority
          className="drop-shadow-xl mb-2 h-auto"
          style={{ width: '80%', maxWidth: '360px' }}
        />
        <div className="flex gap-2 w-full mb-2">
          {/* Tabs */}
          <div className="flex rounded-2xl overflow-hidden border border-[#243028] flex-1 min-w-0">
            {(['create', 'join'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`py-2.5 text-sm font-semibold transition-colors ${
                  tab === t ? 'text-white' : 'text-[#6a8870] hover:bg-[#161d17]'
                }`}
                style={{ flex: t === 'create' ? 2 : 1, ...(tab === t ? { background: '#2e8c3e' } : {}) }}
              >
                {t === 'create' ? '⛳ Nieuw rondje' : '🔗 Doe mee'}
              </button>
            ))}
          </div>
          {/* Agenda icoon */}
          <a href="/agenda"
            className="flex items-center justify-center rounded-2xl px-3 shrink-0 transition-colors"
            style={{ background: '#161d17', border: '1px solid #243028', color: '#fff' }}
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
        <div className="w-full max-w-lg mx-auto px-4 flex flex-col gap-3 py-2">
        {tab === 'create' ? (
          <>
            {/* Baan + instellingen */}
            <div className="card flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#6a8870] uppercase tracking-wide">Golfbaan</label>
                  <button
                    type="button"
                    onClick={detectLocationByGPS}
                    disabled={gpsLoading}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ background: '#0e160f', border: '1px solid #243028', color: '#6a8870' }}
                  >
                    {gpsLoading ? '⏳' : '📍'} {gpsLoading ? 'Zoeken...' : 'GPS'}
                  </button>
                </div>
                <input
                  className="input"
                  placeholder="Naam van de golfbaan"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  list="course-suggestions"
                  autoComplete="off"
                />
                {knownCourses.length > 0 && (
                  <datalist id="course-suggestions">
                    {knownCourses.map((c) => <option key={c} value={c} />)}
                  </datalist>
                )}
                <input
                  className="input"
                  placeholder="Plaats (bijv. Oirschot)"
                  value={courseLocation}
                  onChange={(e) => setCourseLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#6a8870] uppercase tracking-wide">Holes</label>
                  <select className="input" value={holes} onChange={(e) => setHoles(Number(e.target.value) as 9 | 18)}>
                    <option value={18}>18 holes</option>
                    <option value={9}>9 holes</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-[#6a8870] uppercase tracking-wide">Systeem</label>
                    <button
                      type="button"
                      onClick={() => setShowScoringInfo((v) => !v)}
                      className="w-4 h-4 rounded-full text-[10px] font-bold leading-none flex items-center justify-center shrink-0 transition-colors"
                      style={{ background: '#243028', color: '#6a8870' }}
                      title="Uitleg scoring"
                    >
                      ?
                    </button>
                  </div>
                  <select className="input" value={scoringSystem} onChange={(e) => setScoringSystem(e.target.value as 'strokeplay' | 'stableford')}>
                    <option value="stableford">Stableford</option>
                    <option value="strokeplay">Strokeplay</option>
                  </select>
                  {showScoringInfo && (
                    <div className="rounded-xl p-3 mt-1 text-xs flex flex-col gap-2 leading-relaxed"
                         style={{ background: '#0e160f', border: '1px solid #243028', color: '#a0c8a0' }}>
                      <div>
                        <span className="font-bold" style={{ color: '#f5c842' }}>Stableford</span>
                        {' '}— je scoort punten per hole op basis van je handicap. Par = 2 punten, birdie = 3, bogey = 1. Hoge score wint. Minder erg als je een slechte hole hebt.
                      </div>
                      <div>
                        <span className="font-bold" style={{ color: '#e8521a' }}>Strokeplay</span>
                        {' '}— gewoon slagen tellen over alle holes. Lage score wint. Klassiek toernooi-formaat.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Spelers */}
            <div className="card flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>
                  Spelers
                </label>
                {scoringSystem === 'stableford' && (
                  <span className="text-xs" style={{ color: '#4a6450' }}>naam · handicap</span>
                )}
              </div>
              {knownPlayers.length > 0 && (
                <datalist id="player-suggestions">
                  {knownPlayers.map((p) => <option key={p} value={p} />)}
                </datalist>
              )}
              {playerRows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center rounded-xl px-3 py-2" style={{ background: '#0e160f', border: '1px solid #1e2c20' }}>
                  <span className="text-xs font-bold w-5 text-center shrink-0" style={{ color: '#2e8c3e' }}>{i + 1}</span>
                  <input
                    className="flex-1 bg-transparent text-sm text-white placeholder-[#2a3a2e] focus:outline-none"
                    placeholder={`Naam speler ${i + 1}`}
                    value={row.name}
                    onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                    list="player-suggestions"
                    autoComplete="off"
                  />
                  {scoringSystem === 'stableford' && (
                    <input
                      className="w-14 bg-transparent text-center text-sm text-white placeholder-[#2a3a2e] focus:outline-none rounded-lg py-0.5"
                      style={{ border: '1px solid #243028' }}
                      placeholder="HCP"
                      type="number"
                      min={0}
                      max={54}
                      value={row.handicap}
                      onChange={(e) => updatePlayer(i, 'handicap', e.target.value)}
                    />
                  )}
                  {playerRows.length > 1 && (
                    <button
                      onClick={() => removePlayer(i)}
                      className="text-xl leading-none w-6 shrink-0 transition-colors"
                      style={{ color: '#2a3a2e' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e8521a')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#2a3a2e')}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {playerRows.length < 30 && (
                <button
                  onClick={addPlayer}
                  className="text-sm font-semibold rounded-xl px-4 py-2 transition-colors mt-1"
                  style={{ background: '#0e160f', border: '1px solid #2e8c3e', color: '#2e8c3e' }}
                >
                  + Speler toevoegen
                </button>
              )}
            </div>

          </>
        ) : (
          <div className="card flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6a8870] uppercase tracking-wide">Rondje-code</label>
              <input
                className="input text-center text-2xl tracking-[0.3em] uppercase font-bold"
                placeholder="ABCDEF"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={20}
              />
              <p className="text-xs text-[#4a6450] text-center mt-1">
                Vraag de code bij de score-invoerder of scan de QR-code.
              </p>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Vaste actieknoppen onderaan */}
      <div className="shrink-0 w-full max-w-lg px-4 pb-3 pt-2 flex flex-col gap-2"
           style={{ borderTop: '1px solid #1a2c1e' }}>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {tab === 'create' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={createRound}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold text-sm transition-colors disabled:opacity-40"
                style={{ background: '#2e8c3e', color: '#fff' }}
              >
                <span className="text-3xl leading-none shrink-0">{loading ? '⏳' : '🏌️'}</span>
                <span className="text-xs leading-tight">{loading ? '...' : 'Rondje starten'}</span>
              </button>
              <a
                href="/history"
                className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold text-sm"
                style={{ background: '#f5c842', color: '#0e160f' }}
              >
                <span className="text-3xl leading-none shrink-0">🏆</span>
                <span className="text-xs leading-tight">Voorgaande edities</span>
              </a>
            </div>
          </>
        ) : (
          <button onClick={joinRound} disabled={loading} className="btn-primary">
            {loading ? 'Zoeken...' : 'Naar leaderboard 🏆'}
          </button>
        )}
      </div>

    </main>
  );
}
