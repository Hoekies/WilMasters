'use client';

import { useState } from 'react';

export default function Footer() {
  const [open, setOpen] = useState(false);

  return (
    <footer className="w-full max-w-lg mx-auto sm:max-w-xl px-4 pb-6 mt-auto">
      {/* Over-panel */}
      {open && (
        <div className="mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid #222e22' }}>
          <div className="px-4 py-4 flex flex-col gap-2 text-sm leading-relaxed" style={{ background: '#141f14', color: '#6a8e6a' }}>
            <p>
              Ooit dacht iemand: <em>&ldquo;Laten we een balletje slaan.&rdquo;</em> Dat balletje
              werd een rondje. Dat rondje werd een traditie. Die traditie heeft nu een eigen app.
            </p>
            <p>
              De Willemien&apos;s Masters zijn het meest serieuze niet-serieuze golfevenement
              in de vakantie. Begonnen als een gezellig uitje op de shortgolfbaan, uitgegroeid
              tot een heuse competitie met echte deelnemers, neppe trofeeën en oprechte spanning.
              Elke editie wordt het net iets competitiever — maar de borrel erna blijft gelukkig hetzelfde. 🍺
            </p>
          </div>
        </div>
      )}

      {/* Footer balk */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#222e22' }}>Hoekies 2026</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: '#4a664a', border: '1px solid #1a2a1a' }}
        >
          <span>⛳</span>
          <span>Over</span>
          <span style={{ fontSize: '8px' }}>{open ? '▲' : '▼'}</span>
        </button>
      </div>
    </footer>
  );
}
