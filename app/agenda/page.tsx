'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Activity } from '@/lib/types';
import Image from 'next/image';
import Link from 'next/link';

const EMPTY_FORM = { name: '', description: '', dateTime: '' };

export default function AgendaPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing?: Activity }>({ open: false });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'activities'), orderBy('dateTime', 'asc'));
    return onSnapshot(q, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity));
    });
  }, []);

  function openAdd() {
    setForm(EMPTY_FORM);
    setModal({ open: true });
  }

  function openEdit(a: Activity) {
    const dt = new Date(a.dateTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    setForm({ name: a.name, description: a.description ?? '', dateTime: local });
    setModal({ open: true, editing: a });
  }

  function closeModal() {
    setModal({ open: false });
    setForm(EMPTY_FORM);
  }

  async function save() {
    if (!form.name.trim() || !form.dateTime) return;
    setSaving(true);
    const data: Omit<Activity, 'id'> = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      dateTime: new Date(form.dateTime).getTime(),
      createdAt: Date.now(),
    };
    if (modal.editing?.id) {
      await updateDoc(doc(db, 'activities', modal.editing.id), data as Record<string, unknown>);
    } else {
      await addDoc(collection(db, 'activities'), data);
    }
    setSaving(false);
    closeModal();
  }

  async function confirmDelete(id: string) {
    await deleteDoc(doc(db, 'activities', id));
    setDeleteId(null);
  }

  const now = Date.now();
  const upcoming = activities.filter((a) => a.dateTime >= now);
  const past = activities.filter((a) => a.dateTime < now);

  return (
    <main className="flex flex-col min-h-screen gap-4 max-w-lg mx-auto w-full sm:max-w-xl">

      {/* Logo */}
      <Link href="/" className="flex justify-center pt-4 px-4">
        <Image src="/logo-breed.png" alt="Willemien's Masters" width={600} height={180}
          className="h-auto drop-shadow-lg" style={{ width: '70%' }} priority />
      </Link>

      {/* Header */}
      <div className="px-4 flex items-center justify-between">
        <h1 className="font-bold text-base sm:text-lg">Agenda</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openAdd}
            className="flex items-center justify-center w-9 h-9 rounded-xl text-xl transition-colors"
            style={{ background: '#3d9a3d', color: '#fff' }}
            title="Activiteit toevoegen"
          >
            ＋
          </button>
          <Link href="/"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-base transition-colors"
            style={{ background: '#243d24', border: '1px solid #3a6b3a' }}
            title="Home"
          >
            🏠
          </Link>
        </div>
      </div>

      {/* Upcoming */}
      <div className="px-4 flex flex-col gap-3">
        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-12" style={{ color: '#5a8a5a' }}>
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm">Nog geen activiteiten gepland.</p>
            <p className="text-xs mt-1">Druk op ＋ om iets toe te voegen.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#5a8a5a' }}>Aankomend</p>
            <div className="grid grid-cols-2 gap-3">
              {upcoming.map((a) => (
                <ActivityCard key={a.id} activity={a} onEdit={openEdit}
                  onDelete={(id) => setDeleteId(id)} />
              ))}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide mt-2" style={{ color: '#3a5a3a' }}>Geweest</p>
            <div className="grid grid-cols-2 gap-3 opacity-50">
              {past.map((a) => (
                <ActivityCard key={a.id} activity={a} onEdit={openEdit}
                  onDelete={(id) => setDeleteId(id)} isPast />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal: toevoegen / bewerken */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4"
             style={{ background: 'rgba(0,0,0,0.7)' }}
             onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="w-full max-w-md rounded-2xl flex flex-col gap-4 p-5"
               style={{ background: '#1f3a1f', border: '1px solid #3a6b3a' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base">
                {modal.editing ? 'Activiteit bewerken' : 'Activiteit toevoegen'}
              </h2>
              <button onClick={closeModal} className="text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                      style={{ color: '#7fbf7f' }}>×</button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7fbf7f' }}>Naam *</label>
                <input className="input" placeholder="bijv. Editie 2026" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7fbf7f' }}>Datum & tijd *</label>
                <input className="input" type="datetime-local" value={form.dateTime}
                  onChange={(e) => setForm((f) => ({ ...f, dateTime: e.target.value }))}
                  style={{ colorScheme: 'dark' }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7fbf7f' }}>
                  Omschrijving <span style={{ color: '#3a5a3a' }}>(optioneel)</span>
                </label>
                <textarea className="input resize-none" rows={2} placeholder="Korte omschrijving..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.dateTime}
              className="btn-primary"
            >
              {saving ? '...' : modal.editing ? '💾 Opslaan' : '➕ Toevoegen'}
            </button>
          </div>
        </div>
      )}

      {/* Verwijder bevestiging */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6"
             style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4"
               style={{ background: '#1f3a1f', border: '1px solid #7a2a1a' }}>
            <p className="text-sm text-center">Activiteit verwijderen?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1">Annuleren</button>
              <button onClick={() => confirmDelete(deleteId)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: '#7a2a1a', color: '#fff' }}>
                🗑 Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ActivityCard({
  activity, onEdit, onDelete, isPast = false,
}: {
  activity: Activity;
  onEdit: (a: Activity) => void;
  onDelete: (id: string) => void;
  isPast?: boolean;
}) {
  const dt = new Date(activity.dateTime);
  const dateLine = dt.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeLine = dt.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

  // Countdown
  const diff = activity.dateTime - Date.now();
  const days = Math.ceil(diff / 86400000);
  const countdown = !isPast && days >= 0
    ? days === 0 ? 'Vandaag!' : days === 1 ? 'Morgen' : `Over ${days} dagen`
    : null;

  return (
    <div className="rounded-2xl p-3 flex flex-col gap-2 relative"
         style={{ background: '#243d24', border: `1px solid ${isPast ? '#2a3a2a' : '#3a6b3a'}` }}>

      {/* Actie-iconen */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => onEdit(activity)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
          style={{ background: '#1c3a1c', color: '#7fbf7f' }} title="Bewerken">✏️</button>
        <button onClick={() => activity.id && onDelete(activity.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors"
          style={{ background: '#1c3a1c', color: '#e8521a' }} title="Verwijderen">🗑</button>
      </div>

      {/* Datum blokje */}
      <div className="flex flex-col">
        <span className="text-2xl font-black leading-none" style={{ color: isPast ? '#3a5a3a' : '#f5c842' }}>
          {dt.getDate()}
        </span>
        <span className="text-xs" style={{ color: '#7fbf7f' }}>
          {dt.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 pr-8">
        <p className="font-bold text-sm leading-tight">{activity.name}</p>
        {activity.description && (
          <p className="text-xs leading-relaxed" style={{ color: '#7fbf7f' }}>{activity.description}</p>
        )}
        <p className="text-xs mt-0.5" style={{ color: '#5a8a5a' }}>{timeLine} · {dateLine}</p>
        {countdown && (
          <p className="text-xs font-semibold mt-0.5" style={{ color: '#3d9a3d' }}>{countdown}</p>
        )}
      </div>
    </div>
  );
}
