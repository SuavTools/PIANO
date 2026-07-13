// ---------------------------------------------------------------------------
// upper.ts — choosing upper-structure triads for a whole progression.
//
// Two separate problems, and the second is the one that matters:
//
//   1. WHICH triads are legal over this chord? A triad whose notes clash with
//      the chord's own guide tones isn't colour, it's a mistake.
//
//   2. WHICH SEQUENCE of legal triads sounds intentional? This is the hard one.
//      Upper structures that jump around at random sound worse than no upper
//      structures at all, because the ear hears the top of the voicing as a
//      MELODY. So we solve the whole progression at once, minimising how far the
//      triads move between chords — the upper structures become a line.
// ---------------------------------------------------------------------------

import { QUALITIES, type BuiltChord, type QualityId, type WorkingChord } from "./music";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/**
 * Which intervals above the chord root a triad note is ALLOWED to occupy.
 * Everything else fights something the chord has already said.
 */
function allowedTensions(q: QualityId): Set<number> {
  // major family: no ♭3, no ♭7, no ♭9/♭13, and no ♮11 (it fights the 3rd)
  const MAJOR = [0, 2, 4, 6, 7, 9, 11];
  // minor family: Dorian — ♮6 is in, ♮3 and ♮7 are out
  const MINOR = [0, 2, 3, 5, 7, 9, 10];
  // dominants take almost any tension. Just not the ♮7 (fights the ♭7) or the
  // ♮11 (fights the 3rd). That permissiveness is why USTs live here.
  const DOM = [0, 1, 2, 3, 4, 6, 7, 8, 9, 10];
  // suspended: no 3rd of any kind
  const SUS = [0, 2, 5, 7, 9, 10];

  switch (q) {
    case "maj": case "maj7": case "maj9": case "maj7#11": case "6/9": case "add9":
      return new Set(MAJOR);
    case "min": case "min7": case "min9": case "min11": case "min6/9": case "minAdd9":
      return new Set(MINOR);
    case "minMaj7":
      return new Set([0, 2, 3, 5, 7, 9, 11]);
    case "dom7": case "dom9": case "dom13": case "dom7#9": case "dom7b9":
      return new Set(DOM);
    case "dom7sus": case "sus4": case "quartal":
      return new Set(SUS);
    case "sus2":
      return new Set([0, 2, 4, 5, 7, 9, 11]);
    case "m7b5":
      return new Set([0, 2, 3, 5, 6, 8, 10]);
    case "dim7":
      return new Set([0, 2, 3, 5, 6, 8, 9, 11]); // whole-half
  }
}

/** the chord's own root/3rd/5th — a triad made of these adds nothing */
function basicTones(q: QualityId): Set<number> {
  const def = QUALITIES[q];
  if (q === "m7b5" || q === "dim7") return new Set([0, 3, 6]);
  if (q === "dom7sus" || q === "sus4" || q === "quartal") return new Set([0, 5, 7]);
  if (q === "sus2") return new Set([0, 2, 7]);
  return new Set([0, def.minor ? 3 : 4, 7]);
}

/** how much colour a given tension carries — ♯11 and 13 are the good stuff */
const COLOUR: Record<number, number> = {
  0: 0, 4: 0, 7: 0,       // chord tones: no colour at all
  2: 3,                   // 9
  6: 4,                   // ♯11
  9: 3,                   // 13
  5: 2,                   // 11
  1: 2, 3: 2, 8: 2,       // ♭9 ♯9 ♭13 — spice, mostly on dominants
  10: 1, 11: 1,           // ♭7 / 7
};

export type Candidate = { upperPc: number; colour: number; tensions: number[] };

/** Every legal, worthwhile upper triad over this chord. */
export function upperCandidates(rootPc: number, quality: QualityId): Candidate[] {
  const allowed = allowedTensions(quality);
  const basic = basicTones(quality);
  const out: Candidate[] = [];

  // Enumerate by INTERVAL above the chord root, not by absolute pitch-class.
  // When two candidates score the same the solver takes the first, so ordering
  // by interval is what makes the answer identical in every key — otherwise
  // transposing a progression could silently swap its polychords for equally
  // good but different ones.
  for (let step = 0; step < 12; step++) {
    const u = mod12(rootPc + step);
    const tensions = [0, 4, 7].map((iv) => mod12(u + iv - rootPc));

    // every note of the triad must be a legal tension over this chord
    if (!tensions.every((t) => allowed.has(t))) continue;

    // and it has to actually ADD something — a triad made of the chord's own
    // root, 3rd and 5th is just the chord again
    const added = tensions.filter((t) => !basic.has(t));
    if (added.length < 2) continue;

    out.push({
      upperPc: mod12(u),
      colour: tensions.reduce((a, t) => a + (COLOUR[t] ?? 0), 0),
      tensions,
    });
  }
  return out;
}

/** shortest distance between two pitch-classes, 0–6 */
const pcDist = (a: number, b: number) => {
  const d = mod12(a - b);
  return Math.min(d, 12 - d);
};

/**
 * How far two triads are apart when each voice takes its nearest partner.
 * This is the number that decides whether the upper structures sound like a
 * line or like someone dropping cutlery.
 */
function triadMotion(a: number, b: number): number {
  const A = [0, 4, 7].map((i) => mod12(a + i));
  const B = [0, 4, 7].map((i) => mod12(b + i));
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  let best = Infinity;
  for (const p of perms) {
    let sum = 0;
    for (let i = 0; i < 3; i++) sum += pcDist(A[i], B[p[i]]);
    best = Math.min(best, sum);
  }
  return best;
}

/** how much we care about smooth motion versus rich colour */
const MOTION_WEIGHT = 1.0;
const COLOUR_WEIGHT = 0.55;

/**
 * Pick an upper structure for every chord at once, so the triads voice-lead
 * through the progression instead of lurching. Straight Viterbi: the cost of a
 * choice is how far it moved from the last one, minus how much colour it adds.
 */
export function solveUppers(chords: BuiltChord[]): (number | null)[] {
  if (!chords.length) return [];

  const cands = chords.map((ch) => upperCandidates(ch.rootPc, ch.quality));

  // a chord with no legal upper structure just doesn't get one
  if (cands.every((c) => !c.length)) return chords.map(() => null);

  type Cell = { cost: number; prev: number };
  let prevRow: Cell[] = cands[0].map((c) => ({
    cost: -COLOUR_WEIGHT * c.colour,
    prev: -1,
  }));

  const back: Cell[][] = [prevRow];

  for (let i = 1; i < chords.length; i++) {
    const row: Cell[] = cands[i].map((c) => {
      let best = Infinity;
      let bestPrev = -1;

      if (!cands[i - 1].length) {
        best = -COLOUR_WEIGHT * c.colour;
      } else {
        cands[i - 1].forEach((p, pi) => {
          const cost =
            prevRow[pi].cost +
            MOTION_WEIGHT * triadMotion(p.upperPc, c.upperPc) -
            COLOUR_WEIGHT * c.colour;
          if (cost < best) { best = cost; bestPrev = pi; }
        });
      }
      return { cost: best, prev: bestPrev };
    });

    back.push(row);
    prevRow = row.length ? row : prevRow;
  }

  // walk the cheapest path back
  const out: (number | null)[] = chords.map(() => null);
  let k = -1;
  let bestCost = Infinity;
  back[back.length - 1].forEach((cell, i) => {
    if (cell.cost < bestCost) { bestCost = cell.cost; k = i; }
  });

  for (let i = chords.length - 1; i >= 0; i--) {
    if (k < 0 || !cands[i][k]) { out[i] = null; k = -1; continue; }
    out[i] = cands[i][k].upperPc;
    k = back[i][k].prev;
  }

  return out;
}

/** Apply the solved upper structures to the working chords. */
export function applyUppers(
  working: WorkingChord[],
  built: BuiltChord[],
): WorkingChord[] {
  const uppers = solveUppers(built);
  return working.map((wc, i) => ({ ...wc, upper: uppers[i] ?? null }));
}

export const clearUppers = (working: WorkingChord[]): WorkingChord[] =>
  working.map((wc) => ({ ...wc, upper: null }));
