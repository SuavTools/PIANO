// ---------------------------------------------------------------------------
// melody.ts — a melody generator that isn't a drill.
//
// The trap with "random melody" is that randomness is the opposite of music.
// What actually makes a line sound composed:
//
//   MOTIF     — state an idea, then repeat and sequence it. This matters most.
//   SPACE     — rests. A drill never stops for breath; a melody does.
//   RHYTHM    — long notes, pickups, syncopation, gaps. Not eight eighths.
//   CONTOUR   — an arc with a peak, not a random walk.
//   DEVICES   — arpeggios, scale runs, enclosures, neighbour tones, leaps that
//               recover — mixed, so no single trick wears out.
//   TARGETING — chord tones on strong beats; land on the next chord's guide
//               tone exactly as it arrives.
//
// Everything is seeded, so a melody is reproducible and "new idea" is a reseed.
// ---------------------------------------------------------------------------

import { SCALES_FOR, noteNameFor, type BuiltChord, type QualityId } from "./music";
import { guideTones } from "./voiceleading";
import { bebopFor } from "./exercises";
import { stepToBeat, type Groove } from "./groove";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

const LO = 55;  // G3
const HI = 84;  // C6
const BEATS_PER_BAR = 4;

/** mulberry32 — small, fast, deterministic */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// ---------------------------------------------------------------------------
// Rhythm cells — on an 8-step eighth grid. The RESTS are the point: a bar that
// starts on the "and of 1" sounds phrased; a bar of eight eighths sounds typed.
// ---------------------------------------------------------------------------
type Cell = { steps: { step: number; dur: number }[]; density: number };

const RHYTHMS: Cell[] = [
  { density: 0.1, steps: [{ step: 0, dur: 4 }, { step: 4, dur: 4 }] },                       // two half notes
  { density: 0.2, steps: [{ step: 0, dur: 3 }, { step: 3, dur: 2 }, { step: 6, dur: 2 }] },  // long, syncopated
  { density: 0.3, steps: [{ step: 2, dur: 2 }, { step: 4, dur: 1 }, { step: 5, dur: 3 }] },  // enters late — space up top
  { density: 0.4, steps: [{ step: 0, dur: 2 }, { step: 2, dur: 1 }, { step: 3, dur: 1 }, { step: 4, dur: 2 }, { step: 6, dur: 2 }] },
  { density: 0.5, steps: [{ step: 0, dur: 1 }, { step: 1, dur: 1 }, { step: 2, dur: 2 }, { step: 5, dur: 1 }, { step: 6, dur: 1 }, { step: 7, dur: 1 }] }, // gap in the middle
  { density: 0.6, steps: [{ step: 3, dur: 1 }, { step: 4, dur: 1 }, { step: 5, dur: 1 }, { step: 6, dur: 1 }, { step: 7, dur: 1 }] }, // pickup phrase
  { density: 0.7, steps: [{ step: 0, dur: 1 }, { step: 1, dur: 1 }, { step: 2, dur: 1 }, { step: 3, dur: 1 }, { step: 4, dur: 2 }, { step: 6, dur: 1 }, { step: 7, dur: 1 }] },
  { density: 0.9, steps: Array.from({ length: 8 }, (_, i) => ({ step: i, dur: 1 })) },       // straight 8ths
];

type Gesture = "arp" | "scale" | "enclose" | "motif" | "neighbour" | "leap" | "repeat";

export type MelodyNote = {
  midi: number;
  name: string;
  /** absolute position in beats, including swing and human drift */
  beat: number;
  durBeats: number;
  velocity: number;
  chordIndex: number;
  role: "target" | "chord" | "approach" | "scale" | "chromatic";
  gesture: Gesture;
};

export type MelodyOpts = {
  seed: number;
  /** how busy the rhythm is */
  density: number;
  /** how often an idea gets repeated or sequenced — the musicality dial */
  motif: number;
  /** how much chromatic approach material creeps in */
  chromaticism: number;
  /** how much the line leaps versus steps */
  leap: number;
  /** timing/velocity slop */
  humanize: number;
};

export const DEFAULT_MELODY: MelodyOpts = {
  seed: 1,
  density: 0.55,
  motif: 0.5,
  chromaticism: 0.4,
  leap: 0.25,
  humanize: 0.4,
};

const near = (pc: number, ref: number) => Math.round((ref - pc) / 12) * 12 + mod12(pc);

/** every note of a scale, in order, across the singing range */
function ladderOf(pcs: number[]): number[] {
  const out: number[] = [];
  for (let m = LO; m <= HI; m++) if (pcs.includes(mod12(m))) out.push(m);
  return out;
}
const nearestIdx = (ladder: number[], midi: number) => {
  let best = 0;
  let d = Infinity;
  ladder.forEach((m, i) => {
    const dd = Math.abs(m - midi);
    if (dd < d) { d = dd; best = i; }
  });
  return best;
};

export function generateMelody(
  chords: BuiltChord[],
  tonicPc: number,
  groove: Groove,
  opts: MelodyOpts,
): MelodyNote[] {
  if (!chords.length) return [];
  const rand = rng(opts.seed * 2654435761);
  const out: MelodyNote[] = [];

  let cursor = 67; // G4 — where a melody naturally sits
  /** the last bar's interval shape, so we can sequence it into the next chord */
  let lastShape: number[] | null = null;
  let lastRhythm: Cell | null = null;

  chords.forEach((ch, ci) => {
    const next = chords[ci + 1] ?? null;
    const progress = chords.length > 1 ? ci / (chords.length - 1) : 0;

    // CONTOUR: an arc — the line climbs to a peak about two-thirds through,
    // then comes back down. Without this it just wanders.
    const arc = Math.sin(Math.PI * Math.min(1, progress * 1.15)) * 7;
    const centre = 67 + arc;

    const arpPcs = ARP[ch.quality].map((iv) => mod12(ch.rootPc + iv));
    const scale = SCALES_FOR[ch.quality][0];
    const scalePcs = scale.intervals.map((iv) => mod12(ch.rootPc + iv));
    const bb = bebopFor(ch.quality);
    const bbPcs = bb.intervals.map((iv) => mod12(ch.rootPc + iv));

    const ladder = ladderOf(bbPcs.length ? bbPcs : scalePcs);
    const arpSet = new Set(arpPcs);

    // ---- rhythm: reuse the last bar's rhythm sometimes. Repetition is what
    // makes a listener hear an IDEA rather than a stream of notes.
    const reuseRhythm = lastRhythm && rand() < opts.motif;
    const cell = reuseRhythm
      ? lastRhythm!
      : pickRhythm(rand, opts.density);
    lastRhythm = cell;

    const slots = cell.steps;
    if (!slots.length) return;

    // ---- gesture
    const gesture: Gesture = pickGesture(rand, opts, lastShape !== null, next !== null);

    // ---- the target we're heading for: the next chord's 3rd, landing on its
    // downbeat. That's what makes a line sound like it MEANT to get there.
    const target = next ? near(guideTones(next, tonicPc).third, cursor) : null;

    const midis = renderGesture({
      gesture, slots, ladder, arpSet, arpPcs, scalePcs,
      cursor, centre, target, rand, opts, lastShape,
    });

    // remember the shape (as intervals) so the next bar can sequence it
    lastShape = midis.slice(1).map((m, i) => m - midis[i]);

    slots.forEach((slot, i) => {
      const midi = midis[i];
      if (midi === undefined) return;

      const strong = slot.step % 4 === 0;
      const pc = mod12(midi);
      const role: MelodyNote["role"] =
        target !== null && i === slots.length - 1 && !arpSet.has(pc) ? "approach"
          : arpSet.has(pc) ? "chord"
            : scalePcs.includes(pc) ? "scale"
              : "chromatic";

      // ---- VELOCITY: downbeats push, off-beats give way, chromatic approach
      // notes are ghosted. This alone is most of the "human" feel.
      let vel = strong ? 0.86 : slot.step % 2 === 0 ? 0.72 : 0.6;
      if (role === "chromatic" || role === "approach") vel -= 0.12;
      if (arc > 5) vel += 0.06; // lean in at the peak of the phrase
      vel += (rand() * 2 - 1) * 0.14 * opts.humanize;

      // ---- MICRO-TIMING: swing from the groove, plus a little drift. Off-beats
      // drag a touch — players do this without thinking.
      const swung = stepToBeat(slot.step, groove.swing);
      const drag = (slot.step % 2 === 1 ? 0.012 : 0) + (rand() * 2 - 1) * 0.03 * opts.humanize;

      out.push({
        midi,
        name: noteNameFor(midi, tonicPc),
        beat: ci * BEATS_PER_BAR + swung + drag + groove.laidBack,
        durBeats: Math.max(0.12, slot.dur * 0.5 * (0.72 + rand() * 0.3)),
        velocity: Math.min(1, Math.max(0.25, vel)),
        chordIndex: ci,
        role,
        gesture,
      });
    });

    cursor = midis[midis.length - 1] ?? cursor;

    // the target lands on the next bar's downbeat — as a real note
    if (target !== null) cursor = target;
  });

  // resolve: the last note should land somewhere that sounds finished
  if (out.length) {
    const last = out[out.length - 1];
    const ch = chords[last.chordIndex];
    const arpPcs = ARP[ch.quality].map((iv) => mod12(ch.rootPc + iv));
    if (!arpPcs.includes(mod12(last.midi))) {
      // snapping to the root can fall through the floor of the range — the
      // nearest root isn't necessarily a singable one
      let fixed = near(arpPcs[0], last.midi);
      while (fixed < LO) fixed += 12;
      while (fixed > HI) fixed -= 12;
      last.midi = fixed;
      last.name = noteNameFor(fixed, tonicPc);
      last.role = "chord";
    }
    last.durBeats = Math.max(last.durBeats, 1.5);
  }

  return out;
}

// ---------------------------------------------------------------------------
function pickRhythm(rand: () => number, density: number): Cell {
  // weight cells toward the requested density, but never lock to one
  const weights = RHYTHMS.map((c) => 1 / (0.12 + Math.abs(c.density - density)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < RHYTHMS.length; i++) {
    r -= weights[i];
    if (r <= 0) return RHYTHMS[i];
  }
  return RHYTHMS[4];
}

function pickGesture(
  rand: () => number,
  o: MelodyOpts,
  hasShape: boolean,
  hasNext: boolean,
): Gesture {
  const pool: [Gesture, number][] = [
    ["arp", 1.0],
    ["scale", 1.0],
    ["neighbour", 0.5],
    ["repeat", 0.35],
    ["leap", 0.5 * o.leap * 2],
    ["enclose", hasNext ? 1.4 * (0.4 + o.chromaticism) : 0],
    ["motif", hasShape ? 2.4 * o.motif : 0],
  ];
  const total = pool.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [g, w] of pool) {
    r -= w;
    if (r <= 0) return g;
  }
  return "scale";
}

type RenderArgs = {
  gesture: Gesture;
  slots: { step: number; dur: number }[];
  ladder: number[];
  arpSet: Set<number>;
  arpPcs: number[];
  scalePcs: number[];
  cursor: number;
  centre: number;
  target: number | null;
  rand: () => number;
  opts: MelodyOpts;
  lastShape: number[] | null;
};

function renderGesture(a: RenderArgs): number[] {
  const { gesture, slots, ladder, arpSet, arpPcs, cursor, centre, target, rand, opts } = a;
  const n = slots.length;
  const out: number[] = [];

  // start near where we left off, pulled gently toward the contour arc
  const startRef = Math.round(cursor * 0.6 + centre * 0.4);

  const stepLadder = (from: number, k: number) => {
    const i = nearestIdx(ladder, from);
    return ladder[Math.min(ladder.length - 1, Math.max(0, i + k))];
  };

  const chordToneNear = (ref: number) => {
    let best = ref;
    let d = Infinity;
    for (const pc of arpPcs) {
      const m = near(pc, ref);
      const dd = Math.abs(m - ref);
      if (dd < d) { d = dd; best = m; }
    }
    return best;
  };

  switch (gesture) {
    case "arp": {
      const dir = rand() < 0.55 ? 1 : -1;
      let m = chordToneNear(startRef);
      out.push(m);
      for (let i = 1; i < n; i++) {
        // next chord tone in the chosen direction
        const sorted = arpPcs.map((pc) => near(pc, m)).sort((x, y) => x - y);
        let cand = dir > 0
          ? sorted.find((x) => x > m) ?? m + 12
          : [...sorted].reverse().find((x) => x < m) ?? m - 12;
        if (cand > HI) cand -= 12;
        if (cand < LO) cand += 12;
        m = cand;
        out.push(m);
      }
      break;
    }

    case "scale": {
      const dir = rand() < 0.5 ? 1 : -1;
      let m = chordToneNear(startRef);
      out.push(m);
      for (let i = 1; i < n; i++) {
        m = stepLadder(m, dir);
        out.push(m);
      }
      break;
    }

    case "neighbour": {
      // circle a chord tone: T, above, T, below — the most vocal gesture there is
      const t = chordToneNear(startRef);
      for (let i = 0; i < n; i++) {
        const phase = i % 4;
        out.push(
          phase === 0 || phase === 2 ? t
            : phase === 1 ? stepLadder(t, 1)
              : stepLadder(t, -1),
        );
      }
      break;
    }

    case "repeat": {
      // insist on one note, then move off it — rhythm as the subject
      const t = chordToneNear(startRef);
      for (let i = 0; i < n; i++) {
        out.push(i < n - 2 ? t : stepLadder(t, i === n - 2 ? -1 : -2));
      }
      break;
    }

    case "leap": {
      // a big interval, then recover stepwise the other way — the ear forgives
      // any leap if you walk back from it
      const from = chordToneNear(startRef);
      const up = rand() < 0.5 ? 1 : -1;
      const to = chordToneNear(from + up * (7 + Math.floor(rand() * 5)));
      out.push(from, to);
      let m = to;
      for (let i = 2; i < n; i++) {
        m = stepLadder(m, -up);
        out.push(m);
      }
      break;
    }

    case "motif": {
      // THE move: replay the last bar's interval shape, but starting from a
      // chord tone of THIS chord. Same idea, new harmony — that's a sequence.
      const shape = a.lastShape ?? [];
      let m = chordToneNear(startRef);
      out.push(m);
      for (let i = 1; i < n; i++) {
        const iv = shape[(i - 1) % Math.max(shape.length, 1)] ?? 2;
        m = m + iv;
        if (m > HI) m -= 12;
        if (m < LO) m += 12;
        // pull it back into this chord's scale so the shape fits the new chord
        m = stepLadder(m, 0);
        out.push(m);
      }
      break;
    }

    case "enclose": {
      // fill the bar, then wrap the next chord's guide tone in its neighbours
      const t = target ?? chordToneNear(startRef);
      const tail = [t + 1, t - 1]; // above, below — the target lands next bar
      const head = Math.max(0, n - tail.length);

      let m = chordToneNear(startRef);
      for (let i = 0; i < head; i++) {
        out.push(m);
        m = stepLadder(m, t > m ? 1 : -1);
      }
      tail.forEach((x) => out.push(x));
      break;
    }
  }

  // ---- STRONG BEATS WANT CHORD TONES. Nudge anything that isn't one, unless
  // it's deliberate approach material heading into the next chord.
  slots.forEach((slot, i) => {
    if (slot.step % 4 !== 0) return;
    if (out[i] === undefined) return;
    if (gesture === "enclose" && i >= n - 2) return;
    if (arpSet.has(mod12(out[i]))) return;
    if (rand() < 0.15 + opts.chromaticism * 0.2) return; // let a few tensions stand
    out[i] = chordToneNear(out[i]);
  });

  // keep it singable
  return out.map((m) => Math.min(HI, Math.max(LO, m)));
}
