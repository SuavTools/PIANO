# 🎹 The Voicing Board

A visual chord-progression helper for piano. Pick a **key** and a **style** —
Neo-Soul, Glasper, R&B, Jazz — and get a board of real voicings laid out across
the keys so you can just look down and play. Tap a card to hear the voicing, or
hit **Play progression** to run the whole thing in time.

- **Root note in coral, color tones in amber** — spot the shape at a glance.
- Every card shares the same keyboard range, so you can compare voicings across
  the progression.
- Real, idiomatic voicings (open ninths, quartal stacks, altered dominants) —
  not textbook root-position triads.
- Built-in Web Audio synth — no samples, works offline.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

Push to a Git repo and import it at [vercel.com/new](https://vercel.com/new), or:

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

No env vars, no backend — it's a fully static Next.js app.

## Adding your own styles & progressions

Everything lives in [`src/lib/music.ts`](src/lib/music.ts):

- **`QUALITIES`** — chord voicings as semitone offsets from the root (offsets can
  exceed an octave to open the voicing up).
- **`STYLES`** — each style holds progressions; each chord is a `{ offset, quality,
  roman }` relative to the tonic, so it transposes to all 12 keys for free.

Add a progression by dropping a new entry into the relevant style's
`progressions` array — that's it.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · Web Audio API.
Fonts: Fraunces (display), Geist + Geist Mono (UI / data).
