// ---------------------------------------------------------------------------
// exercises.ts — the practice material.
//
// An enclosure on its own is a word, not a language. This is the actual
// curriculum: the guide-tone skeleton, arpeggios through the changes, the
// bebop scale (and WHY it has eight notes), digital patterns, and enclosure
// drills — all of them running over the whole progression, so they're
// transferable rather than a party trick over one chord.
// ---------------------------------------------------------------------------

import {
  SCALES_FOR,
  noteNameFor,
  type BuiltChord,
  type QualityId,
} from "./music";
import { guideTones } from "./voiceleading";
import { ENCLOSURES } from "./solo";

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const CENTER = 69; // where a soloist actually sits

// The playable soloing register. Phrases get octave-shifted back inside this —
// without it, an ascending arpeggio drifts upward chord after chord and walks
// off the top of the keyboard.
const LO = 55;
const HI = 81; // high e (64) + 17 frets — anything higher is unplayable on guitar

/** put a pitch-class in the octave nearest a reference note */
const near = (pc: number, ref: number) => Math.round((ref - pc) / 12) * 12 + mod12(pc);

/**
 * Shift a whole phrase by octaves until it sits in the soloing register.
 *
 * The CEILING wins. A wide phrase can't satisfy both bounds, and going too low
 * is harmless (the guitar has strings down to E2, the piano further) whereas
 * going too high is literally unplayable — there's no 20th fret on the high E.
 */
function fitRegister(midis: number[]): number {
  if (!midis.length) return 0;
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);

  let shift = 0;
  while (hi + shift > HI) shift -= 12;
  // only raise it off the floor if that doesn't push it back through the ceiling
  while (lo + shift < LO && hi + shift + 12 <= HI) shift += 12;
  return shift;
}

export type NoteRoleEx = "target" | "chord" | "scale" | "chromatic" | "approach";

export type ExNote = {
  midi: number;
  name: string;
  chordIndex: number;
  /** eighth-note position within the chord */
  beat: number;
  role: NoteRoleEx;
  /** scale/chord degree label, e.g. "3", "♭7" */
  degree: string;
};

// ---------------------------------------------------------------------------
// The arpeggio (R 3 5 7) for each quality — what "outlining the chord" means
// ---------------------------------------------------------------------------
const ARP: Record<QualityId, number[]> = {
  maj: [0, 4, 7, 12], min: [0, 3, 7, 12],
  sus2: [0, 2, 7, 12], sus4: [0, 5, 7, 12],
  dom7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14], minAdd9: [0, 3, 7, 14],
  maj9: [0, 4, 7, 11], maj7: [0, 4, 7, 11], "maj7#11": [0, 4, 7, 11], "6/9": [0, 4, 7, 9],
  min9: [0, 3, 7, 10], min7: [0, 3, 7, 10], min11: [0, 3, 7, 10], "min6/9": [0, 3, 7, 9],
  minMaj7: [0, 3, 7, 11],
  dom9: [0, 4, 7, 10], dom13: [0, 4, 7, 10], "dom7#9": [0, 4, 7, 10], "dom7b9": [0, 4, 7, 10],
  dom7sus: [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  quartal: [0, 5, 7, 10],
};

const DEG: Record<number, string> = {
  0: "R", 1: "♭9", 2: "9", 3: "♭3", 4: "3", 5: "11", 6: "♭5",
  7: "5", 8: "♭13", 9: "13", 10: "♭7", 11: "7",
};
const degOf = (pc: number, rootPc: number) => DEG[mod12(pc - rootPc)] ?? "";

// ---------------------------------------------------------------------------
// BEBOP SCALES — the whole mechanic of bebop, in one idea.
//
// A 7-note scale in straight 8ths puts chord tones on the OFF-beats. Add one
// chromatic passing note (8 notes) and chord tones land on every DOWNBEAT,
// for free, forever. That's not a colour — it's a rhythmic machine.
// ---------------------------------------------------------------------------
type Bebop = {
  intervals: number[];
  /** the chromatic note that makes it eight notes long */
  added: number;
  /**
   * The arpeggio the scale is ALIGNED to. This is the subtle bit: the downbeat
   * property only holds against these four tones. Start on one of them and every
   * one of them lands on a beat — in either direction.
   */
  chordTones: number[];
  name: string;
  why: string;
};

const BEBOP_DOM: Bebop = {
  name: "Bebop dominant",
  intervals: [0, 2, 4, 5, 7, 9, 10, 11], // Mixolydian + ♮7
  added: 11,
  chordTones: [0, 4, 7, 10], // 1 3 5 ♭7
  why: "Mixolydian plus the ♮7, filling the whole-step gap between the ♭7 and the root. Eight notes — so starting from any chord tone, 1, 3, 5 and ♭7 all land on beats.",
};

const BEBOP_MIN: Bebop = {
  name: "Bebop minor (Dorian)",
  intervals: [0, 2, 3, 5, 7, 9, 10, 11], // Dorian + ♮7
  added: 11,
  chordTones: [0, 3, 7, 10], // 1 ♭3 5 ♭7
  why: "Dorian plus the ♮7 — exactly the same trick as the dominant, filling the gap between the ♭7 and the root. 1, ♭3, 5 and ♭7 all land on beats.",
};

const BEBOP_MAJ: Bebop = {
  name: "Bebop major",
  intervals: [0, 2, 4, 5, 7, 8, 9, 11], // Ionian + ♯5
  added: 8,
  chordTones: [0, 4, 7, 9], // 1 3 5 6 — the SIXTH chord, not the maj7
  why: "Major plus the ♯5, passing between the 5 and the 6. Here's the catch Barry Harris built a whole method on: it aligns to the SIXTH chord (1-3-5-6), not the maj7. That's why jazz players reach for 6/9 chords instead of maj7 — the 6th is the note the scale is actually built around.",
};

export function bebopFor(q: QualityId): Bebop {
  if (q.startsWith("dom") || q === "quartal" || q === "sus4") return BEBOP_DOM;
  if (q.startsWith("min") || q === "m7b5" || q === "dim7" || q === "minMaj7") return BEBOP_MIN;
  return BEBOP_MAJ;
}

// ---------------------------------------------------------------------------
// Digital patterns — the 4-note cells bebop is built from. Indices into the
// chord's scale, so "1-2-3-5" means scale degrees 1, 2, 3 and 5.
// ---------------------------------------------------------------------------
export const CELLS = [
  { id: "1235", name: "1-2-3-5", idx: [0, 1, 2, 4], why: "The most common cell in all of bebop. Ascending, lands open." },
  { id: "1357", name: "1-3-5-7", idx: [0, 2, 4, 6], why: "The straight arpeggio as a cell — outlines the chord unambiguously." },
  { id: "3579", name: "3-5-7-9", idx: [2, 4, 6, 8], why: "Start on the 3rd and you're instantly inside the harmony. The most 'jazz'-sounding entry." },
  { id: "7531", name: "7-5-3-1", idx: [6, 4, 2, 0], why: "Descending arpeggio. Falling from the 7th is how you resolve into the next chord." },
  { id: "5321", name: "5-3-2-1", idx: [4, 2, 1, 0], why: "A descending resolution cell — very vocal, very Parker." },
  { id: "1231", name: "1-2-3-1", idx: [0, 1, 2, 0], why: "Coker's turn cell. Doubling back makes it sound composed rather than run." },
] as const;

// ---------------------------------------------------------------------------
export type ExerciseId =
  | "guide-tones" | "arpeggio" | "bebop-scale" | "digital" | "enclosure-drill" | "bebop-line";

export type Exercise = {
  id: ExerciseId;
  name: string;
  teaches: string;
  practice: string;
  /** eighth-notes generated per chord */
  perChord: number;
};

export const EXERCISES: Exercise[] = [
  {
    id: "guide-tones",
    name: "1 · Guide-tone line",
    teaches:
      "The skeleton. Play only the 3rds and 7ths of each chord and connect them by the smallest possible move. This is the sound of the changes with everything else stripped away — if you can hear this, you can hear the tune.",
    practice:
      "Play it slowly, in time, with no other notes. Then sing it. Every jazz musician starts here, and most come back to it forever.",
    perChord: 2,
  },
  {
    id: "arpeggio",
    name: "2 · Arpeggios through the changes",
    teaches:
      "Outline each chord with its own R–3–5–7. Starting from the 3rd or the 7th (rather than the root) is the difference between sounding like an exercise and sounding like music.",
    practice:
      "Run it from the root first. Then force yourself to start every chord from the 3rd. Then the 7th. That's where the real fluency is.",
    perChord: 8,
  },
  {
    id: "bebop-scale",
    name: "3 · The bebop scale",
    teaches:
      "The engine of the whole style. A 7-note scale in straight 8ths puts chord tones on the OFF-beat. Add one chromatic passing note — 8 notes — and the chord tones land on every downbeat automatically. Bebop is a rhythmic device, not a colour.",
    practice:
      "Run it descending from the root in straight 8ths and watch the chord tones fall on the beat. Then start from the 3rd, the 5th, the 7th — it works from any chord tone.",
    perChord: 8,
  },
  {
    id: "digital",
    name: "4 · Digital patterns",
    teaches:
      "The 4-note cells the language is actually built from. Take one cell and run it over every chord in the tune — that's how Parker practised, and it's how the vocabulary becomes automatic.",
    practice:
      "One cell, all the changes, all twelve keys. Boring, and it works. Change cell only when the current one is effortless.",
    perChord: 8,
  },
  {
    id: "enclosure-drill",
    name: "5 · Enclosure drill",
    teaches:
      "Take one chord tone as a target and surround it chromatically on EVERY chord, then continue up the arpeggio. This is the exercise that turns an enclosure from a trick into a reflex.",
    practice:
      "Target the 3rd of every chord for a week. Then the 7th. Then the 9th. Don't move on until you stop thinking about it.",
    perChord: 8,
  },
  {
    id: "bebop-line",
    name: "6 · Full bebop line",
    teaches:
      "Everything at once: run the chord, then enclose the 3rd of the NEXT chord so you land on it exactly as it arrives. This is what all of the above was for.",
    practice:
      "Learn it, then change one thing — a different enclosure, a different target. Vocabulary is variations on a small number of shapes.",
    perChord: 8,
  },
];

export type ExOpts = {
  startDegree: number; // index into the arpeggio: 0=R, 1=3rd, 2=5th, 3=7th
  cellId: string;
  encId: string;
  targetDegree: number; // 0=R 1=3rd 2=5th 3=7th
  descending: boolean;
};

export const DEFAULT_OPTS: ExOpts = {
  startDegree: 1, // from the 3rd — the musical default
  cellId: "1235",
  encId: "scale-chrom",
  targetDegree: 1,
  descending: true,
};

// ---------------------------------------------------------------------------
export function generateExercise(
  id: ExerciseId,
  chords: BuiltChord[],
  tonicPc: number,
  opts: ExOpts,
): ExNote[] {
  if (!chords.length) return [];

  const out: ExNote[] = [];
  let cursor = CENTER;

  // notes for the chord currently being generated — flushed (and octave-fitted)
  // at the end of each chord, so no phrase can drift off the keyboard
  let phrase: { midi: number; chordIndex: number; beat: number; role: NoteRoleEx; rootPc: number }[] = [];

  const push = (midi: number, chordIndex: number, beat: number, role: NoteRoleEx, rootPc: number) =>
    phrase.push({ midi, chordIndex, beat, role, rootPc });

  const flush = () => {
    if (!phrase.length) return;
    const shift = fitRegister(phrase.map((p) => p.midi));
    for (const p of phrase) {
      const midi = p.midi + shift;
      out.push({
        midi,
        name: noteNameFor(midi, tonicPc),
        chordIndex: p.chordIndex,
        beat: p.beat,
        role: p.role,
        degree: degOf(mod12(midi), p.rootPc),
      });
    }
    // carry on from where the phrase actually ended, in its real register
    cursor = out[out.length - 1].midi;
    phrase = [];
  };

  // ---- 1. guide tones: the 7th and the 3rd, moving as little as possible ----
  if (id === "guide-tones") {
    chords.forEach((ch, i) => {
      const g = guideTones(ch, tonicPc);
      const seventh = near(g.seventh, cursor);
      push(seventh, i, 0, "target", ch.rootPc);
      const third = near(g.third, seventh);
      push(third, i, 4, "target", ch.rootPc);
      cursor = third;
      flush();
    });
    return out;
  }

  // ---- 6. the composed line (delegates to solo.ts) ----
  if (id === "bebop-line") {
    // handled by the caller via generateLine — kept here for a single entry point
    return out;
  }

  chords.forEach((ch, i) => {
    const arp = ARP[ch.quality].map((iv) => mod12(ch.rootPc + iv));
    const scale = SCALES_FOR[ch.quality][0];
    const scalePcs = scale.intervals.map((iv) => mod12(ch.rootPc + iv));

    // ---- 2. arpeggio through the changes ----
    if (id === "arpeggio") {
      // A ladder of this chord's tones across the playable range. Climbing by
      // index can't run off the keyboard — and a triad's arpeggio repeats every
      // three notes, so a naive ascending walk would otherwise span three
      // octaves and get dumped into the bass by the register fitter.
      const tones = [...new Set(arp)];
      const ladder: number[] = [];
      for (let m = LO; m <= HI; m++) if (tones.includes(mod12(m))) ladder.push(m);

      const startPc = arp[opts.startDegree % arp.length];
      let idx = 0;
      let best = Infinity;
      ladder.forEach((m, k) => {
        if (mod12(m) !== mod12(startPc)) return;
        const d = Math.abs(m - cursor);
        if (d < best) { best = d; idx = k; }
      });

      for (let k = 0; k < 8; k++) {
        const m = ladder[Math.min(idx + k, ladder.length - 1)];
        push(m, i, k, "chord", ch.rootPc);
      }
      flush();
      cursor -= 12; // start the next chord near where this one began, not its peak
      return;
    }

    // ---- 3. the bebop scale ----
    if (id === "bebop-scale") {
      const bb = bebopFor(ch.quality);
      const pcs = bb.intervals.map((iv) => mod12(ch.rootPc + iv));
      const addedPc = mod12(ch.rootPc + bb.added);

      // The downbeat property ONLY holds against the scale's aligned arpeggio,
      // and only if you START on one of its tones. Both of those matter.
      const aligned = bb.chordTones.map((iv) => mod12(ch.rootPc + iv));
      const alignedSet = new Set(aligned);

      const startPc = aligned[opts.startDegree % aligned.length];
      let m = near(startPc, cursor + (opts.descending ? 6 : -6));

      for (let k = 0; k < 8; k++) {
        if (k > 0) {
          for (let d = 1; d <= 12; d++) {
            const cand = opts.descending ? m - d : m + d;
            if (pcs.includes(mod12(cand))) { m = cand; break; }
          }
        }
        const pc = mod12(m);
        const role: NoteRoleEx =
          pc === addedPc ? "chromatic" : alignedSet.has(pc) ? "chord" : "scale";
        push(m, i, k, role, ch.rootPc);
      }
      flush();
      return;
    }

    // ---- 4. digital patterns ----
    if (id === "digital") {
      const cell = CELLS.find((c) => c.id === opts.cellId) ?? CELLS[0];
      const arpSet = new Set(arp);

      // A physical ladder of every scale note in the playable register. Indexing
      // into this can't run off the keyboard, however far the cell reaches.
      const ladder: number[] = [];
      for (let m = LO; m <= HI; m++) if (scalePcs.includes(mod12(m))) ladder.push(m);

      // start from the chord's root nearest where we left off
      let root = 0;
      let bestDist = Infinity;
      ladder.forEach((m, k) => {
        if (mod12(m) !== mod12(ch.rootPc)) return;
        const d = Math.abs(m - cursor);
        if (d < bestDist) { bestDist = d; root = k; }
      });

      // run the cell from the root, then again from the 3rd — eight notes
      [0, 2].forEach((shift, rep) => {
        cell.idx.forEach((ix, k) => {
          const at = Math.min(root + ix + shift, ladder.length - 1);
          const m = ladder[at];
          push(m, i, rep * 4 + k, arpSet.has(mod12(m)) ? "chord" : "scale", ch.rootPc);
        });
      });
      flush();
      return;
    }

    // ---- 5. enclosure drill ----
    if (id === "enclosure-drill") {
      const enc = ENCLOSURES.find((e) => e.id === opts.encId) ?? ENCLOSURES[3];
      const targetPc = arp[opts.targetDegree % arp.length];
      const target = near(targetPc, cursor);
      const seq = enc.build(target, scalePcs); // ends ON the target
      const arpSet = new Set(arp);

      seq.forEach((m, k) => {
        const isTarget = k === seq.length - 1;
        push(m, i, k, isTarget ? "target" : "approach", ch.rootPc);
      });

      // then keep climbing the arpeggio from the target — the drill has to
      // go somewhere, otherwise you only ever practise the landing
      let m = target;
      const startIdx = arp.indexOf(targetPc);
      for (let k = seq.length; k < 8; k++) {
        const deg = (startIdx + (k - seq.length) + 1) % arp.length;
        let next = near(arp[deg], m);
        if (next <= m) next += 12;
        m = next;
        push(m, i, k, arpSet.has(mod12(m)) ? "chord" : "scale", ch.rootPc);
      }
      flush();
      return;
    }
  });

  return out;
}
