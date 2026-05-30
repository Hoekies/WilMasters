# Golf z'n Loatst

Live golf score-app voor kleine groepen (max 30 spelers). Geen download vereist — spelers scannen een QR-code of voeren een code in om het live leaderboard te zien.

## Features

- Nieuw rondje aanmaken met spelerlijst en handicaps
- Scores invoeren per hole (strokeplay of Stableford)
- Real-time leaderboard via Firebase Firestore
- Rondje delen via code of link

## Lokaal draaien

```bash
# 1. Kopieer de environment-template
cp .env.local.example .env.local

# 2. Vul je Firebase-waarden in (zie Firebase Console → Project Settings → Web app)
# Bewerk .env.local

# 3. Installeer dependencies
npm install

# 4. Start de dev-server
npm run dev
```

Open http://localhost:3000 in je browser.

## Firebase instellen

1. Ga naar console.firebase.google.com
2. Maak een nieuw project aan (bijv. `golf-zn-loatst`)
3. Voeg een **Web app** toe → kopieer de config naar `.env.local`
4. Ga naar **Firestore Database** → Maak database aan → kies **test mode** voor nu
5. Later: stel Firestore Security Rules in zodat lezen/schrijven beperkt is

## Deployen via Vercel

1. Push deze map naar een GitHub-repository
2. Ga naar vercel.com → **Add New Project** → importeer de GitHub-repo
3. Voeg de Firebase-omgevingsvariabelen toe onder **Environment Variables** in Vercel
4. Klik **Deploy** — elke push naar `main` deployt automatisch

## Golfbanen toevoegen (GPS-herkenning)

Bewerk `lib/courses.ts` om je eigen golfbanen toe te voegen met coördinaten:

```ts
{
  id: 'mijn-golfclub',
  name: 'Mijn Golfclub',
  lat: 52.370216,   // vind via Google Maps: rechts-klik → "Wat is hier?"
  lng: 4.895168,
  holes: 18,
  radiusKm: 1.0,
}
```

## Structuur

```
app/                     Next.js App Router pagina's
lib/
  firebase.ts            Firestore verbinding
  scoring.ts             Stableford en strokeplay berekeningen
  courses.ts             Golfbaan GPS-data
  types.ts               TypeScript types
```
