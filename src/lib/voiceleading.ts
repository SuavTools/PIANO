// ---------------------------------------------------------------------------
// voiceleading.ts — the motion between chords.
//
// A progression isn't a list of shapes, it's what moves between them. This
// module finds the common tones, the semitone resolutions, and — most usefully
// — re-picks each chord's inversion so the hand barely has to move.
// ---------------------------------------------------------------------------

import {
  QUALITIES,
  buildChord,
  noteNameFor,
  type BuiltChord,
  type QualityId,
  type WorkingChord,
} from "./music";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

// ---------------------------------------------------------------------------
// Guide tones — the 3rd and the 7th. These two notes define the chord's
// quality, and they're what actually resolve from one chord to the next.
// ---------------------------------------------------------------------------
type Guide = { third: number; seventh: number; thirdName: string; seventhName: string };

const GUIDE_INTERVALS: Record<QualityId, [number, number]> = {
  // triads have no 7th, so the 5th does the second job
  maj:       [4, 7],  min:     [3, 7],
  sus2:      [2, 7],  sus4:    [5, 7],
  dom7:      [4, 10],
  add9:      [4, 2],  minAdd9: [3, 2],
  maj9:      [4, 11], maj7:    [4, 11], "maj7#11": [4, 11], "6/9":  [4, 9],
  min9:      [3, 10], min7:    [3, 10], min11:     [3, 10], "min6/9": [3, 9],
  minMaj7:   [3, 11],
  dom9:      [4, 10], dom13:   [4, 10], "dom7#9":  [4, 10], "dom7b9": [4, 10],
  dom7sus:   [5, 10], // no 3rd — the 4th does the job
  m7b5:      [3, 10], dim7:    [3, 9],
  quartal:   [5, 10],
};

export function guideTones(chord: BuiltChord, tonicPc: number): Guide {
  const [t, s] = GUIDE_INTERVALS[chord.quality];
  const third = mod12(chord.rootPc + t);
  const seventh = mod12(chord.rootPc + s);
  return {
    third,
    seventh,
    thirdName: noteNameFor(third, tonicPc),
    seventhName: noteNameFor(seventh, tonicPc),
  };
}

/**
 * How the guide tones of one chord resolve into the next. A move of 0 is a
 * common tone; a move of 1 semitone is the good stuff.
 */
export type GuideMove = {
  fromName: string;
  toName: string;
  /** shortest signed semitone distance, -6..6 */
  semitones: number;
  label: string; // "7th → 3rd"
};

const signedDistance = (from: number, to: number) => {
  let d = mod12(to - from);
  if (d > 6) d -= 12;
  return d;
};

export function guideMotion(a: BuiltChord, b: BuiltChord, tonicPc: number): GuideMove[] {
  const ga = guideTones(a, tonicPc);
  const gb = guideTones(b, tonicPc);
  // the classic resolution: the 7th of one chord falls to the 3rd of the next
  return [
    {
      fromName: ga.seventhName,
      toName: gb.thirdName,
      semitones: signedDistance(ga.seventh, gb.third),
      label: "7th → 3rd",
    },
    {
      fromName: ga.thirdName,
      toName: gb.seventhName,
      semitones: signedDistance(ga.third, gb.seventh),
      label: "3rd → 7th",
    },
  ];
}

// ---------------------------------------------------------------------------
// Motion between two voicings, as actually played
// ---------------------------------------------------------------------------
export type Motion = {
  common: number;     // notes held between the chords
  steps: number;      // voices moving by 1–2 semitones
  leaps: number;      // voices jumping further
  totalMotion: number; // total semitones travelled
  summary: string;
};

const voiced = (c: BuiltChord) =>
  c.notes.filter((n) => n.role !== "bass").map((n) => n.midi).sort((x, y) => x - y);

export function motionBetween(a: BuiltChord, b: BuiltChord): Motion {
  const va = voiced(a);
  const vb = voiced(b);
  const n = Math.min(va.length, vb.length);

  let common = 0, steps = 0, leaps = 0, total = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(vb[i] - va[i]);
    total += d;
    if (d === 0) common++;
    else if (d <= 2) steps++;
    else leaps++;
  }

  const bits: string[] = [];
  if (common) bits.push(`${common} held`);
  if (steps) bits.push(`${steps} by step`);
  if (leaps) bits.push(`${leaps} leap${leaps === 1 ? "" : "s"}`);

  return {
    common, steps, leaps, totalMotion: total,
    summary: bits.length ? bits.join(" · ") : "—",
  };
}

/** How far the hand travels, used to score a candidate voicing. */
function cost(prev: number[], cand: number[]): number {
  const n = Math.min(prev.length, cand.length);
  let c = 0;
  for (let i = 0; i < n; i++) c += Math.abs(cand[i] - prev[i]);
  c += Math.abs(cand.length - prev.length) * 2; // mild penalty for changing thickness
  return c;
}

/**
 * Re-voice the progression so each chord sits as close as possible to the one
 * before it — try every voicing variant × inversion and keep the cheapest.
 * This is what turns a list of chords into something that sounds intentional.
 */
export function smoothVoicings(chords: WorkingChord[], tonicPc: number): WorkingChord[] {
  if (chords.length < 2) return chords;

  const out: WorkingChord[] = [chords[0]];
  let prev = voiced(buildChord(chords[0], tonicPc));

  for (let i = 1; i < chords.length; i++) {
    const wc = chords[i];
    const variants = QUALITIES[wc.quality].variants;

    let best = wc;
    let bestCost = Infinity;

    for (let v = 0; v < variants.length; v++) {
      const size = variants[v].voicing.length;
      for (let inv = 0; inv < size; inv++) {
        const cand: WorkingChord = { ...wc, variant: v, inversion: inv };
        const c = cost(prev, voiced(buildChord(cand, tonicPc)));
        if (c < bestCost) {
          bestCost = c;
          best = cand;
        }
      }
    }

    out.push(best);
    prev = voiced(buildChord(best, tonicPc));
  }

  return out;
}
