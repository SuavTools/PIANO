// ---------------------------------------------------------------------------
// groove.ts — the difference between "correct" and "music".
//
// Straight whole-bar chords are a spreadsheet. Real comping is: hit it on some
// eighths and not others, delay the off-beats (swing), and let go of the keys
// early (articulation). Three ideas, and suddenly it breathes.
//
// Everything here is in MUSICAL time (beats). Seconds are for the audio engine,
// ticks are for the MIDI file — both are just a conversion at the very end.
// ---------------------------------------------------------------------------

export type Groove = {
  /** how far the off-beat eighths get pushed late, in beats. 1/6 ≈ triplet swing */
  swing: number;
  /** how long a hit rings, as a fraction of the gap to the next one */
  length: number;
  /** timing/velocity jitter, 0–1 */
  humanize: number;
  /** push everything fractionally late — the neo-soul "behind the beat" feel */
  laidBack: number;
  /** one 8-step pattern per chord: 0 = rest, 1 = hit, 2 = accent */
  patterns: number[][];
};

export const STEPS = 8; // eighth notes in a bar
const BEATS_PER_BAR = 4;
export const MAX_SWING = 1 / 6; // triplet swing: the off-beat lands 2/3 through

// ---------------------------------------------------------------------------
export type PatternPreset = { id: string; name: string; steps: number[]; why: string };

export const PATTERNS: PatternPreset[] = [
  { id: "held", name: "Held", steps: [2, 0, 0, 0, 0, 0, 0, 0],
    why: "One chord, whole bar. Where everyone starts, and where nothing grooves." },
  { id: "charleston", name: "Charleston", steps: [2, 0, 0, 1, 0, 0, 0, 0],
    why: "Beat 1 and the 'and' of 2. The single most-used comping rhythm in jazz — two hits and it already swings." },
  { id: "two-four", name: "On 2 & 4", steps: [0, 0, 2, 0, 0, 0, 2, 0],
    why: "Stay off the downbeat entirely and let the bass have it. Instantly sounds like a band." },
  { id: "push", name: "Push", steps: [2, 0, 0, 0, 0, 0, 0, 1],
    why: "Hit 1, then anticipate the next bar by an eighth. That early hit is what makes a band sound urgent." },
  { id: "bossa", name: "Bossa", steps: [2, 0, 0, 1, 0, 1, 0, 0],
    why: "The classic bossa comp — syncopated, never on 3." },
  { id: "stabs", name: "Neo-soul stabs", steps: [2, 0, 1, 0, 0, 1, 0, 1],
    why: "Short, chopped, off the grid. Keep the length low and it clicks like a drum machine." },
  { id: "offbeats", name: "Off-beats", steps: [0, 1, 0, 1, 0, 1, 0, 1],
    why: "Every 'and'. With swing on, this is pure forward motion." },
  { id: "eighths", name: "Straight 8ths", steps: [1, 1, 1, 1, 1, 1, 1, 1],
    why: "Everything. Useful for hearing the swing itself — turn swing up and listen to the off-beats move." },
];

export type FeelPreset = {
  id: string; name: string;
  swing: number; length: number; humanize: number; laidBack: number;
  why: string;
};

export const FEELS: FeelPreset[] = [
  { id: "straight", name: "Straight", swing: 0, length: 0.9, humanize: 0, laidBack: 0,
    why: "Dead on the grid. Machine-like — which is sometimes exactly right." },
  { id: "light", name: "Light swing", swing: 0.08, length: 0.6, humanize: 0.15, laidBack: 0,
    why: "A gentle lilt. Most modern jazz sits closer to this than to full triplet swing." },
  { id: "bebop", name: "Hard swing", swing: MAX_SWING, length: 0.45, humanize: 0.2, laidBack: 0,
    why: "Full triplet swing, short and punchy. The bebop comp." },
  { id: "neosoul", name: "Neo-soul (laid back)", swing: 0.1, length: 0.75, humanize: 0.35, laidBack: 0.04,
    why: "Slightly swung, slightly LATE, slightly sloppy. Playing a hair behind the beat is the whole feel — Dilla built a career on it." },
  { id: "stabs", name: "Staccato stabs", swing: 0.12, length: 0.18, humanize: 0.2, laidBack: 0,
    why: "Let go of the keys almost immediately. The silence between the chords is the rhythm." },
  { id: "lofi", name: "Lo-fi (dusty)", swing: 0.12, length: 0.72, humanize: 0.8, laidBack: 0.07,
    why: "Drunk swing. Heavily behind the beat and deliberately sloppy — the timing falling apart slightly is the entire aesthetic. Push humanize further than feels correct, then stop just before it's wrong." },
];

/**
 * Plain by default: one held chord per bar, dead straight. A groove is
 * something you REACH for — starting the user inside a swung Charleston comp
 * just gets in the way of hearing the chords.
 */
export const defaultGroove = (chordCount: number): Groove => ({
  swing: 0,
  length: 0.95,
  humanize: 0,
  laidBack: 0,
  patterns: Array.from({ length: chordCount }, () => [...PATTERNS[0].steps]), // Held
});

/** Keep the pattern list the same length as the progression. */
export function fitPatterns(g: Groove, chordCount: number): Groove {
  if (g.patterns.length === chordCount) return g;
  const patterns = Array.from({ length: chordCount }, (_, i) =>
    g.patterns[i] ? [...g.patterns[i]] : [...(g.patterns[g.patterns.length - 1] ?? PATTERNS[1].steps)],
  );
  return { ...g, patterns };
}

// ---------------------------------------------------------------------------
// Where an eighth note actually lands
// ---------------------------------------------------------------------------
/** Swing pushes the ODD eighths (the "and"s) late. The downbeats never move. */
export function stepToBeat(step: number, swing: number): number {
  const base = step * 0.5;
  return step % 2 === 1 ? base + swing : base;
}

/** deterministic jitter — no Math.random, so a render never changes the feel */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1..1
}

export type GrooveEvent = {
  midis: number[];
  /** absolute position, in beats from the top */
  beat: number;
  /** how long it rings, in beats */
  durBeats: number;
  /** 0–1 */
  velocity: number;
  chordIndex: number;
  step: number;
};

/**
 * Turn the chords + the groove into actual hits. This is where a progression
 * stops being a list and becomes a performance.
 */
export function buildGroove(voicings: number[][], g: Groove): GrooveEvent[] {
  const out: GrooveEvent[] = [];
  const pats = fitPatterns(g, voicings.length).patterns;

  // every hit in the whole progression, in order — we need the NEXT hit to know
  // how long this one is allowed to ring
  const hits: { chordIndex: number; step: number; accent: boolean; beat: number }[] = [];
  voicings.forEach((_, ci) => {
    const pat = pats[ci] ?? [];
    for (let s = 0; s < STEPS; s++) {
      if (!pat[s]) continue;
      hits.push({
        chordIndex: ci,
        step: s,
        accent: pat[s] === 2,
        beat: ci * BEATS_PER_BAR + stepToBeat(s, g.swing),
      });
    }
  });

  hits.forEach((h, i) => {
    const next = hits[i + 1];
    const gap = next ? next.beat - h.beat : BEATS_PER_BAR - (h.beat % BEATS_PER_BAR);
    const seed = h.chordIndex * 8 + h.step + 1;

    const late = g.laidBack + jitter(seed) * 0.02 * g.humanize;
    const vel =
      (h.accent ? 0.95 : 0.7) + jitter(seed + 99) * 0.15 * g.humanize;

    out.push({
      midis: voicings[h.chordIndex],
      beat: Math.max(0, h.beat + late),
      // never let a hit ring past the next one — that's what makes it staccato
      durBeats: Math.max(0.08, gap * g.length),
      velocity: Math.min(1, Math.max(0.25, vel)),
      chordIndex: h.chordIndex,
      step: h.step,
    });
  });

  return out;
}

/** total length of the groove, in beats */
export const grooveBeats = (chordCount: number) => chordCount * BEATS_PER_BAR;
