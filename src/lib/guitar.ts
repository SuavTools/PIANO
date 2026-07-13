// ---------------------------------------------------------------------------
// guitar.ts — fretboard shapes, solved rather than hand-authored.
//
// Guitarists don't play the piano's 5-note stacks: they play 4-note drop-2 and
// drop-3 grips, dropping the 5th (and sometimes the root) to make room for
// extensions. So each quality declares the four tones a guitarist actually
// grabs, and we search the neck for a grip that fits under one hand.
// ---------------------------------------------------------------------------

import { QUALITIES, noteNameFor, type BuiltChord, type QualityId, type Scale } from "./music";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** open strings, low to high: E2 A2 D3 G3 B3 E4 */
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS = ["E", "A", "D", "G", "B", "e"];
export const FRET_COUNT = 17;

/**
 * The four tones a guitarist actually voices for each quality, as semitone
 * intervals from the root. The 5th is usually the first thing to go.
 */
const GUITAR_TONES: Record<QualityId, number[]> = {
  maj:       [0, 4, 7, 12],
  min:       [0, 3, 7, 12],
  sus2:      [0, 2, 7, 12],
  sus4:      [0, 5, 7, 12],
  dom7:      [0, 4, 7, 10],
  add9:      [0, 4, 7, 2],
  minAdd9:   [0, 3, 7, 2],
  maj9:      [0, 4, 11, 2],   // R 3 7 9  — no 5th
  maj7:      [0, 4, 7, 11],   // R 3 5 7
  "maj7#11": [0, 4, 11, 6],   // R 3 7 ♯11
  "6/9":     [0, 4, 9, 2],    // R 3 6 9
  min9:      [0, 3, 10, 2],   // R ♭3 ♭7 9
  min7:      [0, 3, 7, 10],
  min11:     [0, 3, 10, 5],   // R ♭3 ♭7 11
  "min6/9":  [0, 3, 9, 2],
  minMaj7:   [0, 3, 7, 11],
  dom9:      [0, 4, 10, 2],   // R 3 ♭7 9
  dom13:     [0, 4, 10, 9],   // R 3 ♭7 13
  "dom7#9":  [0, 4, 10, 3],   // the Hendrix grip
  "dom7b9":  [0, 4, 10, 1],
  dom7sus:   [0, 5, 7, 10],   // R 4 5 ♭7
  m7b5:      [0, 3, 6, 10],
  dim7:      [0, 3, 6, 9],
  quartal:   [0, 5, 10, 3],   // stacked fourths
};

/**
 * Which strings ring for each grip family. The muted strings are what make
 * these playable — drop-3 skips the A string under a 6th-string root.
 */
const FAMILIES = [
  { id: "E-shape", rootString: 0, sounding: [0, 2, 3, 4] }, // root on low E (drop 3)
  { id: "A-shape", rootString: 1, sounding: [1, 2, 3, 4] }, // root on A    (drop 2)
  { id: "D-shape", rootString: 2, sounding: [2, 3, 4, 5] }, // root on D    (drop 2)
] as const;

export type FretDot = {
  string: number;      // 0 = low E
  fret: number;        // 0 = open
  name: string;
  degree?: string;
  role: "root" | "tone" | "bass" | "scale";
};

export type Shape = {
  family: string;
  /** fret per string, low to high; null = muted */
  frets: (number | null)[];
  dots: FretDot[];
  midis: number[];
  minFret: number;
  maxFret: number;
};

const MAX_SPAN = 5; // what one hand can actually cover

// ---------------------------------------------------------------------------
// THE SHAPE LIBRARY — the grips guitarists actually play.
//
// A solver can find a fingering whose notes are all correct and which fits
// under one hand, and still produce something no guitarist would ever play.
// Real players use a small set of memorised movable shapes. So these are the
// real ones, written as fret offsets from the root, and the solver below is
// only a fallback for the chords that don't have a standard grip.
//
// Offsets run low-E → high-e. null = muted string.
// ---------------------------------------------------------------------------
type Grip = { family: string; rootString: number; offsets: (number | null)[] };

const E: (o: (number | null)[]) => Grip = (o) => ({ family: "E-shape", rootString: 0, offsets: o });
const A: (o: (number | null)[]) => Grip = (o) => ({ family: "A-shape", rootString: 1, offsets: o });
const D: (o: (number | null)[]) => Grip = (o) => ({ family: "D-shape", rootString: 2, offsets: o });

const SHAPES: Partial<Record<QualityId, Grip[]>> = {
  // ---- the basics: the most-played grips on the instrument. These are the
  // barre and open shapes every guitarist learns in their first month.
  maj: [
    E([0, 2, 2, 1, 0, 0]),            // the E-shape barre
    A([null, 0, 2, 2, 2, 0]),         // the A-shape barre
    D([null, null, 0, 2, 3, 2]),      // the D shape
  ],
  min: [
    E([0, 2, 2, 0, 0, 0]),            // the Em-shape barre
    A([null, 0, 2, 2, 1, 0]),         // the Am-shape barre
    D([null, null, 0, 2, 3, 1]),      // the Dm shape
  ],
  dom7: [
    E([0, 2, 0, 1, 0, 0]),            // E7 barre
    A([null, 0, 2, 0, 2, 0]),         // A7 barre
    D([null, null, 0, 2, 1, 2]),      // D7
  ],
  sus4: [
    E([0, 2, 2, 2, 0, 0]),
    A([null, 0, 2, 2, 3, 0]),
    D([null, null, 0, 2, 3, 3]),
  ],
  sus2: [
    A([null, 0, 2, 2, 0, 0]),
    D([null, null, 0, 2, 3, 0]),
  ],
  add9: [
    A([null, 0, 2, 2, 2, 2]),         // R 5 R 3 9 — the shimmering pop grip
  ],
  minAdd9: [
    A([null, 0, 2, 2, 1, 2]),
  ],

  // ---- major family ----
  maj7: [
    E([0, null, 1, 1, 0, null]),      // R 7 3 5   — the drop-3
    A([null, 0, 2, 1, 2, null]),      // R 5 7 3   — the drop-2
    D([null, null, 0, 2, 2, 2]),
  ],
  maj9: [
    A([null, 0, -1, 1, 0, null]),     // R 3 7 9   — THE maj9 grip
    D([null, null, 0, -1, 2, 0]),
  ],
  "maj7#11": [
    A([null, 0, 1, 1, 2, null]),      // R ♯11 7 3
    D([null, null, 0, 1, 2, 2]),
  ],
  "6/9": [
    A([null, 0, -1, -1, 0, 0]),       // R 3 6 9 5 — the classic 6/9
    D([null, null, 0, -1, 0, 0]),
  ],

  // ---- minor family ----
  min7: [
    E([0, null, 0, 0, 0, null]),      // R ♭7 ♭3 5
    A([null, 0, 2, 0, 1, null]),
    D([null, null, 0, 2, 1, 1]),
  ],
  min9: [
    A([null, 0, -2, 0, 0, null]),     // R ♭3 ♭7 9
    D([null, null, 0, -2, 1, 0]),
  ],
  min11: [
    A([null, 0, 0, 0, 1, null]),      // R 11 ♭7 ♭3
    D([null, null, 0, 0, 1, 1]),
  ],
  "min6/9": [
    A([null, 0, -2, -1, 0, null]),    // R ♭3 6 9
    D([null, null, 0, -2, 0, 0]),
  ],
  minMaj7: [
    E([0, null, 1, 0, 0, null]),
    A([null, 0, 2, 1, 1, null]),
    D([null, null, 0, 2, 2, 1]),
  ],

  // ---- dominant family ----
  dom9: [
    A([null, 0, -1, 0, 0, null]),     // R 3 ♭7 9  — the "9 chord"
    D([null, null, 0, -1, 1, 0]),
  ],
  dom13: [
    E([0, null, 0, 1, 2, null]),      // R ♭7 3 13 — THE 13 grip
    A([null, 0, -1, 0, null, 2]),
  ],
  "dom7#9": [
    A([null, 0, -1, 0, 1, null]),     // R 3 ♭7 ♯9 — the Hendrix
    D([null, null, 0, -1, 1, 1]),
  ],
  "dom7b9": [
    A([null, 0, -1, 0, -1, null]),    // R 3 ♭7 ♭9
    D([null, null, 0, -1, 1, -1]),
  ],
  dom7sus: [
    E([0, null, 0, 2, 0, null]),      // R ♭7 4 5
    A([null, 0, 2, 0, 3, null]),
    D([null, null, 0, 0, 1, 0]),
  ],

  // ---- the rest ----
  m7b5: [
    E([0, null, 0, 0, -1, null]),     // R ♭7 ♭3 ♭5
    A([null, 0, 1, 0, 1, null]),
    D([null, null, 0, 1, 1, 1]),
  ],
  dim7: [
    E([0, null, -1, 0, -1, null]),
    A([null, 0, 1, -1, 1, null]),
    D([null, null, 0, 1, 0, 1]),
  ],
  quartal: [
    A([null, 0, 0, 0, 1, null]),      // R 4 ♭7 ♭3 — stacked fourths
    D([null, null, 0, 0, 1, 1]),
  ],
};

/** Turn a movable grip into a real shape at this chord's root. */
function fromGrip(grip: Grip, chord: BuiltChord, tonicPc: number): Shape | null {
  const rootPc = mod12(chord.rootPc);
  const base = mod12(rootPc - mod12(TUNING[grip.rootString]));

  // try the low position first, then the same shape an octave up
  for (const rootFret of [base, base + 12]) {
    const frets: (number | null)[] = grip.offsets.map((o) =>
      o === null ? null : rootFret + o,
    );
    const sounded = frets.filter((f): f is number => f !== null);
    if (!sounded.length) continue;
    if (sounded.some((f) => f < 0 || f > FRET_COUNT)) continue;

    const dots: FretDot[] = [];
    frets.forEach((f, s) => {
      if (f === null) return;
      const pc = mod12(TUNING[s] + f);
      dots.push({
        string: s,
        fret: f,
        name: noteNameFor(pc, tonicPc),
        degree: degreeFor(chord.quality, mod12(pc - rootPc)),
        role: pc === rootPc ? "root" : "tone",
      });
    });

    const shape: Shape = {
      family: grip.family,
      frets,
      dots,
      midis: dots.map((d) => TUNING[d.string] + d.fret),
      minFret: Math.min(...sounded),
      maxFret: Math.max(...sounded),
    };

    addSlashBass(shape, chord, tonicPc, grip.rootString);
    return shape;
  }
  return null;
}

/** A slash bass, if it can be reached on a lower string that's otherwise muted. */
function addSlashBass(shape: Shape, chord: BuiltChord, tonicPc: number, rootString: number) {
  if (chord.bass === null || mod12(chord.bass) === mod12(chord.rootPc)) return;
  const lo = shape.minFret;
  const hi = shape.maxFret;

  for (let s = 0; s < rootString; s++) {
    if (shape.frets[s] !== null) continue;
    for (let f = Math.max(0, lo - 2); f <= Math.min(FRET_COUNT, hi + 2); f++) {
      if (mod12(TUNING[s] + f) !== mod12(chord.bass)) continue;
      shape.frets[s] = f;
      shape.dots.unshift({
        string: s,
        fret: f,
        name: noteNameFor(mod12(TUNING[s] + f), tonicPc),
        degree: "bass",
        role: "bass",
      });
      shape.midis.unshift(TUNING[s] + f);
      shape.minFret = Math.min(shape.minFret, f);
      shape.maxFret = Math.max(shape.maxFret, f);
      return;
    }
  }
}

/** Degree label for a chord tone, e.g. 0 -> "R", 10 -> "♭7" */
const TONE_DEGREE: Record<number, string> = {
  0: "R", 1: "♭9", 2: "9", 3: "♭3", 4: "3", 5: "11", 6: "♯11",
  7: "5", 8: "♭13", 9: "13", 10: "♭7", 11: "7",
};

// The same interval reads differently depending on the chord: a tritone over a
// dominant is a ♯11, but over a half-diminished it's the ♭5 of the chord itself.
const DEGREE_OVERRIDE: Partial<Record<QualityId, Record<number, string>>> = {
  m7b5: { 6: "♭5" },
  dim7: { 6: "♭5", 9: "°7" },
};

const degreeFor = (quality: QualityId, interval: number) =>
  DEGREE_OVERRIDE[quality]?.[interval] ?? TONE_DEGREE[interval];

/**
 * Search the neck for grips of this chord — one per family, best (tightest
 * span, lowest position) wins within each family.
 */
export function findShapes(chord: BuiltChord, tonicPc: number): Shape[] {
  // Real grips first. Only if this chord has no standard shape do we go
  // hunting on the neck for one.
  const curated = (SHAPES[chord.quality] ?? [])
    .map((g) => fromGrip(g, chord, tonicPc))
    .filter((s): s is Shape => s !== null);

  if (curated.length) return curated;

  return solveShapes(chord, tonicPc);
}

/** Fallback: search the neck for anything playable. */
function solveShapes(chord: BuiltChord, tonicPc: number): Shape[] {
  const intervals = GUITAR_TONES[chord.quality];
  const rootPc = mod12(chord.rootPc);
  const tonePcs = intervals.map((iv) => mod12(rootPc + iv));

  const shapes: Shape[] = [];

  for (const fam of FAMILIES) {
    let best: Shape | null = null;

    // the root can sit in two octaves on its string — try both positions
    const openPc = mod12(TUNING[fam.rootString]);
    const baseFret = mod12(rootPc - openPc);
    for (const rootFret of [baseFret, baseFret + 12]) {
      if (rootFret > FRET_COUNT) continue;

      // the other three strings each take one of the remaining three tones
      const remaining = [...tonePcs];
      remaining.splice(remaining.indexOf(rootPc), 1);
      const others = fam.sounding.filter((s) => s !== fam.rootString);

      // candidate frets per string, near the root's position
      const options = others.map((s) => {
        const list: { fret: number; pc: number }[] = [];
        for (let f = Math.max(0, rootFret - 3); f <= Math.min(FRET_COUNT, rootFret + MAX_SPAN); f++) {
          const pc = mod12(TUNING[s] + f);
          if (remaining.includes(pc)) list.push({ fret: f, pc });
        }
        return list;
      });

      // try every assignment that uses each remaining tone exactly once
      const walk = (i: number, used: number[], picks: { fret: number; pc: number }[]) => {
        if (i === others.length) {
          const frets = [rootFret, ...picks.map((p) => p.fret)];
          const min = Math.min(...frets);
          const max = Math.max(...frets);
          if (max - min > MAX_SPAN) return;

          const cand = assemble(fam, rootFret, others, picks, chord, rootPc, tonicPc);
          if (!best || better(cand, best)) best = cand;
          return;
        }
        for (const opt of options[i]) {
          const k = remaining.indexOf(opt.pc);
          if (k === -1 || used.includes(k)) continue;
          walk(i + 1, [...used, k], [...picks, opt]);
        }
      };
      walk(0, [], []);
    }

    if (best) shapes.push(best);
  }

  return shapes;
}

/** tighter span wins; ties go to the lower position on the neck */
function better(a: Shape, b: Shape) {
  const sa = a.maxFret - a.minFret;
  const sb = b.maxFret - b.minFret;
  if (sa !== sb) return sa < sb;
  return a.minFret < b.minFret;
}

function assemble(
  fam: (typeof FAMILIES)[number],
  rootFret: number,
  others: number[],
  picks: { fret: number; pc: number }[],
  chord: BuiltChord,
  rootPc: number,
  tonicPc: number,
): Shape {
  const frets: (number | null)[] = [null, null, null, null, null, null];
  const dots: FretDot[] = [];

  const push = (string: number, fret: number, role: FretDot["role"]) => {
    frets[string] = fret;
    const pc = mod12(TUNING[string] + fret);
    dots.push({
      string,
      fret,
      name: noteNameFor(pc, tonicPc),
      degree: role === "bass" ? "bass" : degreeFor(chord.quality, mod12(pc - rootPc)),
      role,
    });
  };

  push(fam.rootString, rootFret, "root");
  others.forEach((s, i) => {
    const pc = picks[i].pc;
    push(s, picks[i].fret, pc === rootPc ? "root" : "tone");
  });

  // a slash bass, if it can be reached on a lower string that's otherwise muted
  if (chord.bass !== null && mod12(chord.bass) !== rootPc) {
    const played = dots.map((d) => d.fret);
    const lo = Math.min(...played);
    const hi = Math.max(...played);
    for (let s = 0; s < fam.rootString; s++) {
      if (frets[s] !== null) continue;
      for (let f = Math.max(0, lo - 2); f <= Math.min(FRET_COUNT, hi + 2); f++) {
        if (mod12(TUNING[s] + f) === mod12(chord.bass)) {
          push(s, f, "bass");
          break;
        }
      }
      if (frets[s] !== null) break;
    }
  }

  const sounded = dots.map((d) => d.fret);
  return {
    family: fam.id,
    frets,
    dots,
    midis: dots.map((d) => TUNING[d.string] + d.fret),
    minFret: Math.min(...sounded),
    maxFret: Math.max(...sounded),
  };
}

/**
 * The whole scale mapped across the neck — the classic "here's where it lives"
 * diagram. Chord tones are marked so the shape shows through the scale.
 */
export function scaleDots(
  rootPc: number,
  scale: Scale,
  tonicPc: number,
  chordPcs: Set<number>,
): FretDot[] {
  const dots: FretDot[] = [];
  for (let s = 0; s < TUNING.length; s++) {
    for (let f = 0; f <= FRET_COUNT; f++) {
      const pc = mod12(TUNING[s] + f);
      const iv = mod12(pc - rootPc);
      const idx = scale.intervals.indexOf(iv);
      if (idx === -1) continue;
      const isRoot = iv === 0;
      dots.push({
        string: s,
        fret: f,
        name: noteNameFor(pc, tonicPc),
        degree: scale.degrees[idx],
        role: isRoot ? "root" : chordPcs.has(pc) ? "tone" : "scale",
      });
    }
  }
  return dots;
}

export const qualityLabel = (q: QualityId) => QUALITIES[q].label;
