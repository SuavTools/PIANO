// ---------------------------------------------------------------------------
// suggest.ts — "what could come next?"
//
// Given the chord you're on, the key you're in, and the genre you're chasing,
// generate candidate next chords from actual theory principles — and rank them
// by how well they voice-lead. Every suggestion knows WHY it's a suggestion.
// ---------------------------------------------------------------------------

import {
  QUALITIES,
  buildChord,
  defaultChord,
  noteNameFor,
  romanFor,
  type QualityId,
  type WorkingChord,
} from "./music";
import { motionBetween } from "./voiceleading";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export type PrincipleId =
  | "fifth"
  | "diatonic"
  | "secondary"
  | "tritone"
  | "chromatic"
  | "borrowed"
  | "diminished"
  | "planing";

export type Principle = { id: PrincipleId; name: string; blurb: string };

export const PRINCIPLES: Principle[] = [
  { id: "fifth",      name: "Circle of fifths",   blurb: "Roots falling a fifth — the strongest, most inevitable motion in music." },
  { id: "diatonic",   name: "Diatonic",           blurb: "Chords built from the key itself. Safe, and always correct." },
  { id: "secondary",  name: "Secondary dominant", blurb: "Turn a chord into the V of somewhere else. Borrowed pull." },
  { id: "tritone",    name: "Tritone sub",        blurb: "Swap a V7 for the dominant a half-step above the target. Same guide tones, chromatic bass." },
  { id: "chromatic",  name: "Chromatic step",     blurb: "Slide the whole shape by a half-step. No function — the ear buys it anyway." },
  { id: "borrowed",   name: "Modal interchange",  blurb: "Steal a chord from the parallel minor. Instant ache." },
  { id: "diminished", name: "Passing diminished", blurb: "A °7 glueing two chords a whole step apart." },
  { id: "planing",    name: "Planing",            blurb: "Move the identical voicing in parallel. Modal, weightless." },
];

const NAME: Record<PrincipleId, string> = Object.fromEntries(
  PRINCIPLES.map((p) => [p.id, p.name]),
) as Record<PrincipleId, string>;

/**
 * The palette matters as much as the notes. Suggesting a maj7♯11 over a house
 * loop is useless — pop and dance want TRIADS. So each style gets the chord
 * vocabulary it actually uses.
 */
const SIMPLE_STYLES = new Set(["pop", "house"]);

type Deg = { offset: number; quality: QualityId };

const DIATONIC_JAZZ: Deg[] = [
  { offset: 0, quality: "maj9" },
  { offset: 2, quality: "min9" },
  { offset: 4, quality: "min9" },
  { offset: 5, quality: "maj9" },
  { offset: 7, quality: "dom13" },
  { offset: 9, quality: "min9" },
  { offset: 11, quality: "m7b5" },
];

const DIATONIC_SIMPLE: Deg[] = [
  { offset: 0, quality: "maj" },
  { offset: 2, quality: "min" },
  { offset: 4, quality: "min" },
  { offset: 5, quality: "maj" },
  { offset: 7, quality: "maj" },
  { offset: 9, quality: "min" },
  { offset: 11, quality: "dim7" },
];

const BORROWED_JAZZ: { offset: number; quality: QualityId; label: string }[] = [
  { offset: 5, quality: "min9", label: "the minor iv — the saddest half-step in music" },
  { offset: 10, quality: "dom9", label: "♭VII — the gospel-soul lift" },
  { offset: 8, quality: "maj9", label: "♭VI — borrowed and bright" },
  { offset: 3, quality: "maj9", label: "♭III — lifts without darkening" },
  { offset: 1, quality: "maj9", label: "♭II — the Neapolitan sigh" },
  { offset: 0, quality: "min9", label: "the parallel minor tonic" },
];

const BORROWED_SIMPLE: { offset: number; quality: QualityId; label: string }[] = [
  { offset: 5, quality: "min", label: "the minor iv — instant ache, no theory required" },
  { offset: 10, quality: "maj", label: "♭VII — the rock/house lift" },
  { offset: 8, quality: "maj", label: "♭VI — the big emotional one" },
  { offset: 3, quality: "maj", label: "♭III — lifts without darkening" },
  { offset: 1, quality: "maj", label: "♭II — the Neapolitan sigh" },
  { offset: 0, quality: "min", label: "the parallel minor tonic" },
];

/** which principles each genre reaches for first */
const STYLE_BIAS: Record<string, Partial<Record<PrincipleId, number>>> = {
  jazz:      { fifth: 4, secondary: 3, tritone: 4, diatonic: 1, chromatic: 1 },
  neosoul:   { borrowed: 4, planing: 3, diatonic: 2, chromatic: 2, fifth: 1 },
  glasper:   { planing: 5, chromatic: 4, borrowed: 1, diatonic: 1 },
  rnb:       { diminished: 4, secondary: 3, fifth: 2, borrowed: 2, diatonic: 2 },
  blues:     { fifth: 3, secondary: 2, chromatic: 1, tritone: 1 },
  pop:       { diatonic: 6, fifth: 3, borrowed: 2 },
  house:     { diatonic: 5, borrowed: 4, fifth: 2, planing: 1 },
  movements: {},
};

export type Suggestion = {
  chord: WorkingChord;
  symbol: string;
  roman: string;
  principle: PrincipleId;
  principleName: string;
  why: string;
  score: number;
  /** notes held between the previous chord and this one */
  common: number;
  totalMotion: number;
};

type Cand = { rootPc: number; quality: QualityId; principle: PrincipleId; why: string };

/**
 * Suggest chords that could follow `prev`. If there is no previous chord we
 * suggest ways to START — the tonic and its usual neighbours.
 */
export function suggestNext(
  prev: WorkingChord | null,
  tonicPc: number,
  styleId: string,
  filter: PrincipleId | "all" = "all",
): Suggestion[] {
  const bias = STYLE_BIAS[styleId] ?? {};
  const simple = SIMPLE_STYLES.has(styleId);
  const DIATONIC = simple ? DIATONIC_SIMPLE : DIATONIC_JAZZ;
  const BORROWED = simple ? BORROWED_SIMPLE : BORROWED_JAZZ;
  const DOM: QualityId = simple ? "dom7" : "dom7b9";
  const DOM13: QualityId = simple ? "dom7" : "dom13";
  const cands: Cand[] = [];

  const add = (rootPc: number, quality: QualityId, principle: PrincipleId, why: string) =>
    cands.push({ rootPc: mod12(rootPc), quality, principle, why });

  const n = (pc: number) => noteNameFor(pc, tonicPc);

  // ---- opening the progression ----
  if (!prev) {
    DIATONIC.forEach((d) =>
      add(tonicPc + d.offset, d.quality, "diatonic", `Degree ${d.offset === 0 ? "I" : ""} of the key — a natural place to begin.`),
    );
    return rank(cands, null, tonicPc, bias, filter);
  }

  const L = prev.rootPc;

  // ---- 1. circle of fifths: the root falls a fifth (up a fourth) ----
  {
    const root = L + 5;
    const dia = DIATONIC.find((d) => mod12(tonicPc + d.offset) === mod12(root));
    add(root, dia?.quality ?? (simple ? "maj" : "dom9"), "fifth",
      `Root falls a fifth to ${n(root)}. The 7th of ${n(L)} drops a half-step into its 3rd — the strongest resolution there is.`);
  }

  // ---- 2. everything diatonic, so the safe options are always on the table ----
  DIATONIC.forEach((d) => {
    const root = tonicPc + d.offset;
    if (mod12(root) === mod12(L)) return; // don't suggest the chord we're already on
    add(root, d.quality, "diatonic", `${n(root)} is in the key — it can't be wrong.`);
  });

  // ---- 3. secondary dominants: V7 of each diatonic chord ----
  DIATONIC.forEach((d) => {
    if (d.offset === 0) return;
    const target = mod12(tonicPc + d.offset);
    const root = target + 7; // a fifth above the target
    add(root, DOM, "secondary",
      `${n(root)}7 is the V of ${n(target)} — borrow a dominant to shove you into ${n(target)} next.`);
  });

  // ---- 4. tritone subs: the dominant a half-step ABOVE a target ----
  // Only for targets people actually resolve to — nobody tritone-subs into vii.
  [0, 2, 5, 7, 9].forEach((offset) => {
    const target = mod12(tonicPc + offset);
    const root = mod12(target + 1);
    if (root === mod12(L)) return;
    add(root, DOM13, "tritone",
      `${n(root)}13 shares its 3rd and 7th with ${n(target + 7)}7 (the V of ${n(target)}) — same pull, but the bass slides down a half-step into ${n(target)}.`);
  });

  // ---- 5. chromatic steps: the same chord, a half-step away ----
  [1, -1].forEach((d) =>
    add(L + d, prev.quality, "chromatic",
      `The same shape slid ${d > 0 ? "up" : "down"} a half-step. No theory — the ear just buys a semitone.`),
  );

  // ---- 6. modal interchange ----
  BORROWED.forEach((b) => {
    const root = tonicPc + b.offset;
    if (mod12(root) === mod12(L)) return;
    add(root, b.quality, "borrowed", `${n(root)} borrowed from the parallel minor — ${b.label}.`);
  });

  // ---- 7. passing diminished: glue a whole-step gap ----
  {
    const root = L + 1;
    add(root, "dim7", "diminished",
      `${n(root)}°7 sits between ${n(L)} and ${n(L + 2)} — it's the bass walking chromatically, harmonised.`);
  }

  // ---- 8. planing: the identical voicing, moved in parallel ----
  [2, -2].forEach((d) =>
    add(L + d, prev.quality, "planing",
      `The identical voicing moved ${d > 0 ? "up" : "down"} a whole step. Don't voice-lead — just move the hand.`),
  );

  return rank(cands, prev, tonicPc, bias, filter);
}

// ---------------------------------------------------------------------------
// Ranking.
//
// HARMONIC FUNCTION LEADS. Voice leading only breaks ties — otherwise a chord
// that happens to sit close to your hand outranks the actual V, which is both
// wrong and useless. And we judge voice leading against the chord's SMOOTHEST
// voicing, not whatever variant happens to be the default, so a chord isn't
// punished for an accident of register.
// ---------------------------------------------------------------------------
const BASE: Record<PrincipleId, number> = {
  fifth: 14, diatonic: 9, secondary: 8, tritone: 8,
  borrowed: 7, diminished: 6, chromatic: 5, planing: 5,
};

const isMinorish = (q: QualityId) => q.startsWith("min") || q === "m7b5";
const isDominant = (q: QualityId) => q.startsWith("dom");

/** How far the best voicing of `cand` sits from `prev` — over all variants and inversions. */
function bestMotion(prevBuilt: ReturnType<typeof buildChord>, wc: WorkingChord, tonicPc: number) {
  const variants = QUALITIES[wc.quality].variants;
  let best = { common: 0, steps: 0, leaps: 99, totalMotion: 999 };

  for (let v = 0; v < variants.length; v++) {
    for (let inv = 0; inv < variants[v].voicing.length; inv++) {
      const m = motionBetween(prevBuilt, buildChord({ ...wc, variant: v, inversion: inv }, tonicPc));
      if (m.totalMotion < best.totalMotion) best = m;
    }
  }
  return best;
}

function rank(
  cands: Cand[],
  prev: WorkingChord | null,
  tonicPc: number,
  bias: Partial<Record<PrincipleId, number>>,
  filter: PrincipleId | "all",
): Suggestion[] {
  const prevBuilt = prev ? buildChord(prev, tonicPc) : null;
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const c of cands) {
    if (filter !== "all" && c.principle !== filter) continue;

    // never suggest the chord you're already sitting on (a secondary dominant
    // can otherwise "resolve" to itself, which is not a suggestion)
    if (prev && c.rootPc === mod12(prev.rootPc) && c.quality === prev.quality) continue;

    const key = `${c.rootPc}:${c.quality}`;
    if (seen.has(key)) continue; // first principle to claim a chord keeps it
    seen.add(key);

    const wc: WorkingChord = { ...defaultChord(c.rootPc, c.quality) };
    const built = buildChord(wc, tonicPc);

    let common = 0;
    let totalMotion = 0;
    let vl = 0;
    let pull = 0;

    if (prev && prevBuilt) {
      const m = bestMotion(prevBuilt, wc, tonicPc);
      common = m.common;
      totalMotion = m.totalMotion;

      // a tiebreaker, deliberately small — it must never outvote function
      vl = m.common * 0.8 + m.steps * 0.4 - m.leaps * 0.3;

      // context: a ii or a V *wants* to fall a fifth. Honour that above all.
      const fallsAFifth = mod12(c.rootPc - prev.rootPc) === 5;
      if (fallsAFifth) {
        if (isDominant(prev.quality)) pull += 8; // V resolving is the whole game
        else if (isMinorish(prev.quality)) pull += 6; // ii heading for its V
        else pull += 2;
      }
    }

    const score = BASE[c.principle] + (bias[c.principle] ?? 0) + vl + pull;

    out.push({
      chord: wc,
      symbol: built.symbol,
      roman: built.roman,
      principle: c.principle,
      principleName: NAME[c.principle],
      why: c.why,
      score,
      common,
      totalMotion,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Pick a good-but-not-obvious suggestion — the "bash it and see" button. */
export function surpriseMe(suggestions: Suggestion[], seed: number): Suggestion | null {
  if (!suggestions.length) return null;
  // weight toward the top of the list, but never make it deterministic
  const pool = suggestions.slice(0, Math.min(10, suggestions.length));
  const weights = pool.map((s, i) => Math.max(0.15, 1 - i * 0.09) * (1 + s.score / 20));
  const total = weights.reduce((a, b) => a + b, 0);

  // a cheap deterministic PRNG so the app never calls Math.random during render
  const r = ((Math.sin(seed) * 10000) % 1 + 1) % 1;
  let acc = r * total;
  for (let i = 0; i < pool.length; i++) {
    acc -= weights[i];
    if (acc <= 0) return pool[i];
  }
  return pool[0];
}

/** Chain suggestions to grow a whole progression from where you are. */
export function extendProgression(
  chords: WorkingChord[],
  tonicPc: number,
  styleId: string,
  howMany: number,
  seed: number,
  principle: PrincipleId | "all" = "all",
): WorkingChord[] {
  const out = [...chords];
  for (let i = 0; i < howMany; i++) {
    const prev = out.length ? out[out.length - 1] : null;
    const picks = suggestNext(prev, tonicPc, styleId, principle)
      // don't sit on the same root twice in a row — that's not a progression
      .filter((s) => !prev || s.chord.rootPc !== prev.rootPc);
    const pick = surpriseMe(picks, seed + i * 137);
    if (!pick) break;
    out.push(pick.chord);
  }
  return out;
}

export function romanOf(wc: WorkingChord, tonicPc: number) {
  return romanFor(wc, tonicPc);
}
