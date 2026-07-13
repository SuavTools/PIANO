// ---------------------------------------------------------------------------
// solo.ts — enclosures, target notes, and melodic lines.
//
// The bebop recipe, made literal: pick a TARGET (usually the 3rd or 7th of the
// NEXT chord), surround it with chromatic and scale neighbours, and land on it
// exactly as the chord changes. Everything here returns MIDI, so it renders on
// piano and guitar identically.
// ---------------------------------------------------------------------------

import { SCALES_FOR, type BuiltChord, type Note, noteNameFor } from "./music";
import { guideTones } from "./voiceleading";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** where a soloist actually lives */
const SOLO_CENTER = 74; // ~D5

/** put a pitch-class in the octave nearest a reference note */
function near(pc: number, ref: number): number {
  const base = Math.round((ref - pc) / 12) * 12 + pc;
  return base;
}

// ---------------------------------------------------------------------------
// Targets — the notes worth aiming at
// ---------------------------------------------------------------------------
export type Target = {
  id: string;
  name: string;
  why: string;
  pc: number;
  /** true if this note belongs to the NEXT chord */
  next: boolean;
};

export function targetsFor(chord: BuiltChord, nextChord: BuiltChord | null, tonicPc: number): Target[] {
  const g = guideTones(chord, tonicPc);
  const list: Target[] = [
    { id: "3", name: `3rd — ${g.thirdName}`, why: "The note that makes the chord major or minor. Landing here always sounds 'correct'.", pc: g.third, next: false },
    { id: "7", name: `7th — ${g.seventhName}`, why: "The other guide tone. It's the note that wants to resolve — leaning on it creates pull.", pc: g.seventh, next: false },
    { id: "R", name: `Root — ${chord.rootName}`, why: "Safe and grounding, but the least interesting place to land. Use it to end a phrase.", pc: chord.rootPc, next: false },
  ];

  if (nextChord) {
    const gn = guideTones(nextChord, tonicPc);
    list.push(
      { id: "n3", name: `3rd of the NEXT chord — ${gn.thirdName}`, why: "This is the one. Land on the next chord's 3rd right as it arrives and the line sounds inevitable.", pc: gn.third, next: true },
      { id: "n7", name: `7th of the NEXT chord — ${gn.seventhName}`, why: "Anticipating the next chord's 7th sets up the resolution after it. Very forward-leaning.", pc: gn.seventh, next: true },
    );
  }

  return list;
}

// ---------------------------------------------------------------------------
// Enclosures — how you surround the target before landing on it
// ---------------------------------------------------------------------------
export type Enclosure = {
  id: string;
  name: string;
  note: string;
  /** builds the approach; the LAST note is always the target */
  build: (target: number, scalePcs: number[]) => number[];
};

const scaleUp = (midi: number, pcs: number[]) => {
  for (let m = midi + 1; m <= midi + 12; m++) if (pcs.includes(mod12(m))) return m;
  return midi + 2;
};
const scaleDown = (midi: number, pcs: number[]) => {
  for (let m = midi - 1; m >= midi - 12; m--) if (pcs.includes(mod12(m))) return m;
  return midi - 2;
};

export const ENCLOSURES: Enclosure[] = [
  {
    id: "sandwich",
    name: "Chromatic sandwich",
    note: "A half-step above, a half-step below, then the target. The single most common bebop approach — it works over anything because the two neighbours don't belong to any key, so they can't clash.",
    build: (t) => [t + 1, t - 1, t],
  },
  {
    id: "below-above",
    name: "Below then above",
    note: "The sandwich reversed. Lands with a downward sigh instead of an upward push — softer, more vocal.",
    build: (t) => [t - 1, t + 1, t],
  },
  {
    id: "double-below",
    name: "Double chromatic below",
    note: "Two half-steps climbing from underneath. Pure Charlie Parker — it builds real pressure into the landing.",
    build: (t) => [t - 2, t - 1, t],
  },
  {
    id: "scale-chrom",
    name: "Scale above, chromatic below",
    note: "Step down from the scale tone above, drop under by a half-step, then squeeze up. The most idiomatic enclosure in jazz — one foot in the key, one foot outside it.",
    build: (t, pcs) => [scaleUp(t, pcs), t - 1, t],
  },
  {
    id: "bebop4",
    name: "Four-note bebop enclosure",
    note: "Whole step above, half step above, half step below, land. Four notes, so it fills a beat of eighths perfectly and pulls the ear tight around the target.",
    build: (t) => [t + 2, t + 1, t - 1, t],
  },
  {
    id: "delayed",
    name: "Delayed resolution",
    note: "Touch the target, leave it, circle back. Creates the feeling of a line that almost resolved and thought better of it.",
    build: (t) => [t + 1, t, t - 1, t],
  },
  {
    id: "arp-up",
    name: "Arpeggio into the target",
    note: "Run the chord's own arpeggio upward and let it spill onto the target. Less chromatic, more harmonic — this is how you outline changes clearly.",
    build: (t, pcs) => {
      const a = scaleDown(scaleDown(scaleDown(t, pcs), pcs), pcs);
      const b = scaleDown(scaleDown(t, pcs), pcs);
      const c = scaleDown(t, pcs);
      return [a, b, c, t];
    },
  },
];

/** Build a concrete enclosure on a target, in the soloing register. */
export function buildEnclosure(
  enc: Enclosure,
  targetPc: number,
  scalePcs: number[],
  tonicPc: number,
  ref = SOLO_CENTER,
): Note[] {
  const target = near(targetPc, ref);
  const midis = enc.build(target, scalePcs);
  return midis.map((midi, i) => ({
    midi,
    pc: mod12(midi),
    name: noteNameFor(midi, tonicPc),
    // the order you play them in — rendered on the key / fret
    degree: String(i + 1),
    role: i === midis.length - 1 ? "root" : "scale",
  }));
}

// ---------------------------------------------------------------------------
// The line generator — a full melodic line over the whole progression
// ---------------------------------------------------------------------------
export type LineStyle = "scalar" | "arpeggio";

export type LineNote = {
  midi: number;
  name: string;
  chordIndex: number;
  /** lands on a target as the chord changes */
  isTarget: boolean;
  /** part of the enclosure leading into a target */
  isApproach: boolean;
};

const PER_CHORD = 8; // eighth notes

/** the body of a phrase: either the chord's arpeggio, or a scale run */
function phraseBody(
  chord: BuiltChord,
  pcs: number[],
  style: LineStyle,
  slots: number,
  from: number,
  aim: number,
): number[] {
  if (slots <= 0) return [];

  if (style === "arpeggio") {
    // climb the chord's own tones from wherever we are
    const tones = [...new Set(chord.notes.filter((n) => n.role !== "bass").map((n) => n.pc))]
      .map((pc) => near(pc, from))
      .sort((a, b) => a - b);
    const out: number[] = [];
    for (let k = 0; k < slots; k++) {
      const oct = Math.floor(k / tones.length) * 12;
      out.push(tones[k % tones.length] + oct);
    }
    return out;
  }

  // scalar: walk backwards from the aim so the run ARRIVES exactly at the
  // enclosure — the line leads somewhere instead of wandering
  const ascending = aim >= from;
  const back: number[] = [];
  let m = aim;
  for (let k = 0; k < slots; k++) {
    m = ascending ? scaleDown(m, pcs) : scaleUp(m, pcs);
    back.push(m);
  }
  return back.reverse();
}

/**
 * For each chord: run a phrase, then use an enclosure so the line lands on the
 * NEXT chord's 3rd exactly as that chord arrives. That's the whole trick.
 */
export function generateLine(
  chords: BuiltChord[],
  tonicPc: number,
  style: LineStyle,
  encId = "scale-chrom",
): LineNote[] {
  if (!chords.length) return [];
  const enc = ENCLOSURES.find((e) => e.id === encId) ?? ENCLOSURES[3];

  // pass 1 — decide, for each chord, the enclosure it plays and the target it
  // hands to the next chord's downbeat
  let pos = SOLO_CENTER;
  const plans = chords.map((ch, i) => {
    const scale = SCALES_FOR[ch.quality][0];
    const pcs = scale.intervals.map((iv) => mod12(ch.rootPc + iv));
    const next = chords[i + 1] ?? null;

    let approach: number[] = [];
    let target: number | null = null;

    if (next) {
      const g = guideTones(next, tonicPc);
      target = near(g.third, pos);
      const full = enc.build(target, pcs);
      approach = full.slice(0, -1); // neighbours belong to THIS chord
      pos = approach.length ? approach[approach.length - 1] : pos;
    }

    return { ch, pcs, approach, target };
  });

  // pass 2 — lay the notes out
  const out: LineNote[] = [];
  const add = (midi: number, chordIndex: number, isTarget: boolean, isApproach: boolean) =>
    out.push({ midi, name: noteNameFor(midi, tonicPc), chordIndex, isTarget, isApproach });

  let cursor = SOLO_CENTER;
  let incoming: number | null = null;

  plans.forEach((p, i) => {
    const slots = PER_CHORD - p.approach.length - (incoming !== null ? 1 : 0);
    const aim = p.approach.length ? p.approach[0] : near(p.ch.rootPc, cursor);
    const body = phraseBody(p.ch, p.pcs, style, slots, cursor, aim);

    if (incoming !== null) add(incoming, i, true, false); // lands on beat one
    body.forEach((m) => add(m, i, false, false));
    p.approach.forEach((m) => add(m, i, false, true));

    cursor = p.approach.length
      ? p.approach[p.approach.length - 1]
      : body.length
        ? body[body.length - 1]
        : cursor;
    incoming = p.target;
  });

  return out;
}
