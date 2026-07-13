# 🎹 The Voicing Board

A chord-progression workbench for **piano and guitar**. Build a progression, see
it on the keys or the neck, hear it grooving, learn *why* it works, practise
soloing over it, and export the whole thing as MIDI.

Everything is computed from a music-theory engine — no chord dictionaries, no
hardcoded diagrams. Change the key and all 12 transpose correctly, including the
voice leading, the guitar grips and the polychords.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · Web
Audio API. No runtime dependencies, no backend, fully static.

---

## Build

- **Chord builder** — root, quality (24 of them, from plain triads to `maj7♯11`),
  voicing variant, inversion, slash bass, and upper structure. Every chord is
  editable, reorderable and removable.
- **84 progressions across 9 styles** — Neo-Soul · Glasper/Modal · R&B/Gospel ·
  Jazz · Blues · **Movements** (the devices themselves) · Pop · House/Dance ·
  Lo-Fi (mndsgn). Each one carries a note explaining the **voice-leading reason
  it works**.
- **What comes next?** — a suggestion engine that generates candidates from eight
  theory principles (circle of fifths, secondary dominants, tritone subs,
  chromatic steps, modal interchange, passing diminished, planing, diatonic),
  ranks them by voice leading, and explains each one. Style-aware: it offers
  triads in house, altered dominants in jazz.
- **🍀 Feeling lucky** — rolls key, style, progression, groove and melody at once.

## Understand

- **Voice leading, made visible.** Between every pair of chords: the guide-tone
  resolution (`7th → 3rd  C → B  ½ step`), common tones held, and total voice
  motion.
- **↝ Smooth voicings** — re-picks every inversion to minimise how far the hand
  travels.
- **◆ Upper structures** — stacks a triad on every chord, solved across the whole
  progression so the triads voice-lead as a line (avg ~2 semitones of motion per
  change) instead of lurching.
- **📖 Theory charts** — per genre: how it thinks, what the voices do, what to aim
  at, the scale vocabulary, and the signature devices.

## Play

- **Piano and guitar** — the same progression on a full-width keyboard or a
  17-fret neck. Guitar shapes come from a curated library of the grips players
  actually use (`Am = x-0-2-0-1-x`, `G13 = 3-x-3-4-5-x`), not solver output.
- **Every note is playable** — click any key, any fret, any note in the tab.
- **7 sounds** — Rhodes, Grand piano, Organ, Pluck, Pad, **Bell** and **Clav**
  (the last two are high-passed and transparent, for auditing stacked voicings).
- **♫ Groove** — swing, note length (staccato ↔ legato), humanize, and an 8-step
  sequencer per chord. Feels: Straight · Light swing · Hard swing · Neo-soul
  (laid back) · Staccato stabs · Lo-fi (dusty).
- **Scale overlays** — see any scale on the keys or across the whole neck, with
  the chord tones lit up inside it.

## Solo

- **♪ Solo workshop** — six exercises that run over your whole progression:
  guide-tone lines, arpeggios through the changes, **the bebop scale** (with the
  downbeat mechanic made visible), digital patterns, enclosure drills, and a
  full bebop line. Rendered as **guitar tab** or a **piano roll**.
- **♪ Melody** — a generator built on motifs, space, contour and mixed devices
  rather than randomness, with per-note velocity and micro-timing.

## Export

**⬇ MIDI** — hand-written Standard MIDI Files (no library). Comp and melody on
separate tracks, with swing, rests, accents, velocities and note lengths intact.
What you hear is what lands in your DAW.

---

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy

Import the repo at [vercel.com/new](https://vercel.com/new). No env vars, no
backend — it's a fully static Next.js app.

## The engine

All the music lives in [`src/lib`](src/lib), and it's all pure and testable:

| | |
|---|---|
| [`music.ts`](src/lib/music.ts) | chords, voicings, scales, keys, the progression library |
| [`voiceleading.ts`](src/lib/voiceleading.ts) | guide tones, motion analysis, the smoothing solver |
| [`upper.ts`](src/lib/upper.ts) | upper-structure legality + the voice-leading solver |
| [`suggest.ts`](src/lib/suggest.ts) | the next-chord engine |
| [`guitar.ts`](src/lib/guitar.ts) | the shape library and fretboard solver |
| [`solo.ts`](src/lib/solo.ts) · [`exercises.ts`](src/lib/exercises.ts) | enclosures, targets, the bebop curriculum |
| [`melody.ts`](src/lib/melody.ts) | the melody generator |
| [`groove.ts`](src/lib/groove.ts) · [`audio.ts`](src/lib/audio.ts) | rhythm, feel, and the synth |
| [`midi.ts`](src/lib/midi.ts) | Standard MIDI File writer |

Adding a progression is a few lines in the `STYLES` array — chords are stored as
scale degrees, so it works in all 12 keys immediately.
