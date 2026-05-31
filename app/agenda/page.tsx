'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Activity } from '@/lib/types';
import Cropper from 'react-easy-crop';
import Image from 'next/image';
import Link from 'next/link';

import { useAdmin } from '@/lib/useAdmin';

/* ── crop helpers ── */
interface Area { x: number; y: number; width: number; height: number; }

async function getCroppedBase64(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((res, rej) => {
    const img = new window.Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const size = 400;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/* ── main component ── */
const EMPTY_FORM = { name: '', description: '', location: '', dateTime: '' };

export default function AgendaPage() {
  const { isAdmin, login, logout } = useAdmin();
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing?: Activity }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loginModal, setLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ user: '', pass: '' });
  const [loginError, setLoginError] = useState('');
  const [saveError, setSaveError] = useState('');

  /* image crop state */
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('dateTime', 'asc'));
    return onSnapshot(q, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity));
    });
  }, []);

  const onCropComplete = useCallback((_: Area, px: Area) => setCroppedArea(px), []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setZoom(1); setCrop({ x: 0, y: 0 }); setShowCrop(true); };
    reader.readAsDataURL(file);
  }

  async function confirmCrop() {
    if (!rawImage || !croppedArea) return;
    const b64 = await getCroppedBase64(rawImage, croppedArea);
    setFinalImage(b64);
    setShowCrop(false);
  }

  function openAdd() {
    if (!isAdmin) { setLoginModal(true); return; }
    setForm(EMPTY_FORM); setFinalImage(null); setRawImage(null); setSaveError('');
    setModal({ open: true });
  }

  function openEdit(a: Activity) {
    if (!isAdmin) { setLoginModal(true); return; }
    const dt = new Date(a.dateTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({ name: a.name, description: a.description ?? '', location: a.location ?? '', dateTime: local });
    setFinalImage(a.image ?? null); setRawImage(null); setSaveError('');
    setModal({ open: true, editing: a });
  }

  function closeModal() { setModal({ open: false }); setForm(EMPTY_FORM); setFinalImage(null); setRawImage(null); }

  async function save() {
    if (!form.name.trim() || !form.dateTime) return;
    setSaving(true);
    setSaveError('');
    try {
      const data: Omit<Activity, 'id'> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        image: finalImage ?? undefined,
        dateTime: new Date(form.dateTime).getTime(),
        createdAt: modal.editing?.createdAt ?? Date.now(),
      };
      if (modal.editing?.id) {
        await updateDoc(doc(db, 'activities', modal.editing.id), data as Record<string, unknown>);
      } else {
        await addDoc(collection(db, 'activities'), data);
      }
      setSaving(false); closeModal();
    } catch (err) {
      setSaving(false);
      const msg = err instanceof Error ? err.message : 'Onbekende fout';
      console.error('Save error:', msg, err);
      setSaveError(`Fout: ${msg}`);
    }
  }

  async function confirmDelete(id: string) {
    await deleteDoc(doc(db, 'activities', id)); setDeleteId(null);
  }

  function doLogin() {
    if (login(loginForm.user, loginForm.pass)) { setLoginModal(false); setLoginForm({ user: '', pass: '' }); setLoginError(''); }
    else setLoginError('Gebruikersnaam of wachtwoord onjuist.');
  }

  const now = Date.now();
  const upcoming = activities.filter((a) => a.dateTime >= now).sort((a, b) => b.dateTime - a.dateTime);
  const past = activities.filter((a) => a.dateTime < now).sort((a, b) => b.dateTime - a.dateTime);

  return (
    <>
      <main className="flex flex-col min-h-screen gap-3 max-w-lg mx-auto w-full sm:max-w-xl">

        {/* Logo */}
        <Link href="/" className="flex justify-center pt-4 px-4">
          <Image src="/logo-breed.png" alt="Willemien's Masters" width={600} height={180}
            className="h-auto drop-shadow-lg" style={{ width: '80%', maxWidth: '360px' }} priority />
        </Link>

        {/* Header */}
        <div className="px-4 flex items-center justify-between">
          <h1 className="font-bold text-lg">Agenda</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <button onClick={openAdd}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-xl font-bold transition-colors"
                  style={{ background: '#2e8c3e', color: '#fff' }} title="Toevoegen">＋</button>
                <button onClick={logout}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-sm transition-colors"
                  style={{ background: '#161d17', border: '1px solid #243028', color: '#6a8870' }} title="Uitloggen">🔓</button>
              </>
            )}
            {!isAdmin && (
              <button onClick={() => setLoginModal(true)}
                className="flex items-center justify-center w-9 h-9 rounded-xl text-sm transition-colors"
                style={{ background: '#161d17', border: '1px solid #243028', color: '#6a8870' }} title="Inloggen">🔒</button>
            )}
            <Link href="/"
              className="flex items-center justify-center w-9 h-9 rounded-xl text-base"
              style={{ background: '#161d17', border: '1px solid #243028' }}>🏠</Link>
          </div>
        </div>

        {/* Kaarten */}
        <div className="px-4 flex flex-col gap-4 pb-4">
          {upcoming.length === 0 && past.length === 0 && (
            <div className="text-center py-12" style={{ color: '#4a6450' }}>
              <p className="text-4xl mb-3">📅</p>
              <p className="text-sm">Nog geen activiteiten gepland.</p>
              {isAdmin && <p className="text-xs mt-1">Druk op ＋ om iets toe te voegen.</p>}
            </div>
          )}

          {upcoming.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4a6450' }}>Aankomend</p>
              <div className="grid grid-cols-2 gap-3">
                {upcoming.map((a) => <ActivityCard key={a.id} activity={a} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteId} />)}
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#2a3a2e' }}>Geweest</p>
              <div className="grid grid-cols-2 gap-3 opacity-50">
                {past.map((a) => <ActivityCard key={a.id} activity={a} isAdmin={isAdmin} onEdit={openEdit} onDelete={setDeleteId} isPast />)}
              </div>
            </>
          )}
        </div>
      </main>

      {mounted && createPortal(
        <>
          {/* Login modal */}
          {loginModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
                 style={{ background: 'rgba(0,0,0,0.8)' }}
                 onClick={(e) => e.target === e.currentTarget && setLoginModal(false)}>
              <div className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
                   style={{ background: '#131a14', border: '1px solid #243028' }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Inloggen</h2>
                  <button onClick={() => setLoginModal(false)} className="text-2xl" style={{ color: '#6a8870' }}>×</button>
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

          {/* Crop modal */}
          {showCrop && rawImage && (
            <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: '#000' }}>
              <div className="flex-1 relative">
                <Cropper image={rawImage} crop={crop} zoom={zoom} aspect={1}
                  onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
              </div>
              <div className="p-4 flex flex-col gap-3" style={{ background: '#131a14' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: '#6a8870' }}>Zoom</span>
                  <input type="range" min={1} max={3} step={0.05} value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowCrop(false)} className="btn-secondary flex-1">Annuleren</button>
                  <button onClick={confirmCrop} className="btn-primary flex-1">Bevestigen</button>
                </div>
              </div>
            </div>
          )}

          {/* Toevoegen/bewerken modal */}
          {modal.open && (
            <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center px-4 pb-4"
                 style={{ background: 'rgba(0,0,0,0.7)' }}
                 onClick={(e) => e.target === e.currentTarget && closeModal()}>
              <div className="w-full max-w-xs rounded-2xl flex flex-col gap-3 p-4 max-h-[90vh] overflow-y-auto"
                   style={{ background: '#131a14', border: '1px solid #243028' }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">{modal.editing ? 'Bewerken' : 'Toevoegen'}</h2>
                  <button onClick={closeModal} className="text-2xl w-8 flex items-center justify-center" style={{ color: '#6a8870' }}>×</button>
                </div>

                {/* Afbeelding */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>
                    Afbeelding <span style={{ color: '#2a3a2e' }}>(optioneel)</span>
                  </label>
                  {finalImage ? (
                    <div className="relative w-full">
                      <div className="w-full aspect-square rounded-lg overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={finalImage} alt="preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button onClick={() => fileRef.current?.click()}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                          style={{ background: '#2c4530', color: '#6a8870' }}>✏️</button>
                        <button onClick={() => { setFinalImage(null); setRawImage(null); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                          style={{ background: '#2c4530', color: '#e8521a' }}>🗑</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full rounded-lg flex flex-col items-center justify-center gap-1.5 text-xs transition-colors py-6"
                      style={{ background: '#2c4530', border: '2px dashed #243028', color: '#4a6450' }}>
                      <span className="text-2xl">📷</span>
                      <span>Foto kiezen</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>Naam *</label>
                  <input className="input" placeholder="bijv. Editie 2026" value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>Datum & tijd *</label>
                  <input className="input" type="datetime-local" value={form.dateTime}
                    onChange={(e) => setForm(f => ({ ...f, dateTime: e.target.value }))} style={{ colorScheme: 'dark' }} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>📍 Locatie <span style={{ color: '#2a3a2e' }}>(optioneel)</span></label>
                  <input className="input" placeholder="bijv. Oirschot" value={form.location}
                    onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6a8870' }}>Omschrijving <span style={{ color: '#2a3a2e' }}>(optioneel)</span></label>
                  <textarea className="input resize-none" rows={2} placeholder="Korte omschrijving..."
                    value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                {saveError && <p className="text-red-400 text-sm">{saveError}</p>}

                <button onClick={save} disabled={saving || !form.name.trim() || !form.dateTime} className="btn-primary">
                  {saving ? '...' : modal.editing ? '💾 Opslaan' : '➕ Toevoegen'}
                </button>
              </div>
            </div>
          )}

          {/* Verwijder bevestiging */}
          {deleteId && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
                 style={{ background: 'rgba(0,0,0,0.7)' }}>
              <div className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
                   style={{ background: '#131a14', border: '1px solid #7a2a1a' }}>
                <p className="text-sm text-center">Activiteit verwijderen?</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Annuleren</button>
                  <button onClick={() => confirmDelete(deleteId)}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold"
                    style={{ background: '#7a2a1a', color: '#fff' }}>🗑 Verwijderen</button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}

function ActivityCard({ activity, isAdmin, onEdit, onDelete, isPast = false }:
  { activity: Activity; isAdmin: boolean; onEdit: (a: Activity) => void; onDelete: (id: string) => void; isPast?: boolean }) {

  const dt = new Date(activity.dateTime);
  const day = dt.getDate();
  const month = dt.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
  const time = dt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const weekday = dt.toLocaleDateString('nl-NL', { weekday: 'long' });

  const diff = activity.dateTime - Date.now();
  const days = Math.ceil(diff / 86400000);
  const countdown = !isPast && days >= 0
    ? days === 0 ? 'Vandaag!' : days === 1 ? 'Morgen!' : `Over ${days} dagen`
    : null;

  const cardBg = isPast ? '#1a2e1a' : '#2a1f0a';
  const cardBorder = isPast ? '#2a3a2a' : '#c87a00';
  const accentColor = isPast ? '#4a6450' : '#f5c842';

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
         style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>

      {/* Afbeelding */}
      {activity.image && (
        <div className="w-full aspect-square overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={activity.image} alt={activity.name} className="w-full h-full object-cover" />
          {isAdmin && (
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button onClick={() => onEdit(activity)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>✏️</button>
              <button onClick={() => activity.id && onDelete(activity.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#e8521a' }}>🗑</button>
            </div>
          )}
        </div>
      )}

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {/* Datum op één regel */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-black leading-none" style={{ color: accentColor }}>{day} {month}</span>
          {isAdmin && !activity.image && (
            <div className="flex gap-1">
              <button onClick={() => onEdit(activity)}
                className="w-6 h-6 flex items-center justify-center rounded text-xs"
                style={{ background: '#2c4530', color: '#6a8870' }}>✏️</button>
              <button onClick={() => activity.id && onDelete(activity.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-xs"
                style={{ background: '#2c4530', color: '#e8521a' }}>🗑</button>
            </div>
          )}
        </div>

        {/* Onderwerp gecentreerd */}
        <p className="font-bold text-sm text-center">{activity.name}</p>
        {activity.description && (
          <p className="text-xs text-center" style={{ color: '#6a8870' }}>{activity.description}</p>
        )}
        {/* Plaats links, tijd rechts */}
        <div className="flex items-center justify-between text-xs" style={{ color: '#4a6450' }}>
          <div className="flex items-center gap-1">
            {activity.location && (
              <>
                <span>📍</span>
                <span>{activity.location}</span>
              </>
            )}
          </div>
          <p className="capitalize">{weekday} · {time}</p>
        </div>
      </div>
    </div>
  );
}
