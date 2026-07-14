// ---------------------------------------------------------------------------
// family.ts — tonicization. "The 2-5 of the chord we're going to."
//
// The idea that unlocks gospel and jazz harmony: ANY chord can be treated as a
// temporary tonic. Once you do, it brings its whole family with it — its own ii,
// its own V, its own passing diminished — and you can borrow any of them to lead
// into it, even though none of them belong to the key you're actually in.
//
// So this module answers two questions about a target chord:
//   1. If this chord were the tonic, what would its family be?
//   2. What can I put IN FRONT of it to make it feel like an arrival?
// ---------------------------------------------------------------------------

import {
  QUALITIES,
  defaultChord,
  noteNameFor,
  type QualityId,
  type WorkingChord,
} from "./music";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

// ---------------------------------------------------------------------------
// 1. The family — the diatonic chords of the key this chord implies
// ---------------------------------------------------------------------------
export type FamilyChord = {
  roman: string;
  rootPc: number;
  quality: QualityId;
  /** what this degree is FOR */
  role: string;
};

const MAJOR_FAMILY: { off: number; roman: string; q: QualityId; qs: QualityId; role: string }[] = [
  { off: 0,  roman: "I",   q: "maj9",  qs: "maj",  role: "home" },
  { off: 2,  roman: "ii",  q: "min9",  qs: "min",  role: "the set-up — this is the '2' in a 2-5" },
  { off: 4,  roman: "iii", q: "min9",  qs: "min",  role: "the tonic wearing a disguise" },
  { off: 5,  roman: "IV",  q: "maj9",  qs: "maj",  role: "the lift; the plagal 'amen'" },
  { off: 7,  roman: "V",   q: "dom13", qs: "dom7", role: "the pull — this is the '5'" },
  { off: 9,  roman: "vi",  q: "min9",  qs: "min",  role: "the relative minor" },
  { off: 11, roman: "vii°", q: "m7b5", qs: "dim7", role: "the leading-tone chord" },
];

const MINOR_FAMILY: { off: number; roman: string; q: QualityId; qs: QualityId; role: string }[] = [
  { off: 0,  roman: "i",    q: "min9",   qs: "min",  role: "home" },
  { off: 2,  roman: "iiø",  q: "m7b5",   qs: "dim7", role: "the set-up — in minor the ii is HALF-DIMINISHED" },
  { off: 3,  roman: "♭III", q: "maj9",   qs: "maj",  role: "the relative major" },
  { off: 5,  roman: "iv",   q: "min9",   qs: "min",  role: "the ache" },
  { off: 7,  roman: "V",    q: "dom7b9", qs: "dom7", role: "the pull — borrowed from major, and it needs the ♭9" },
  { off: 8,  roman: "♭VI",  q: "maj9",   qs: "maj",  role: "the big one" },
  { off: 10, roman: "♭VII", q: "dom9",   qs: "dom7", role: "the flat-side lift" },
];

/** Does this chord behave like a minor tonic? */
const isMinorish = (q: QualityId) => QUALITIES[q].minor;

/**
 * The chords that belong to this chord, if you treat it as a temporary tonic.
 */
export function familyOf(rootPc: number, quality: QualityId, simple: boolean): FamilyChord[] {
  const table = isMinorish(quality) ? MINOR_FAMILY : MAJOR_FAMILY;
  return table.map((d) => ({
    roman: d.roman,
    rootPc: mod12(rootPc + d.off),
    quality: simple ? d.qs : d.q,
    role: d.role,
  }));
}

// ---------------------------------------------------------------------------
// 2. The approaches — what you put in front of it
// ---------------------------------------------------------------------------
export type Approach = {
  id: string;
  name: string;
  why: string;
  /** the chords to insert BEFORE the target */
  chords: WorkingChord[];
  /** how it reads, e.g. "Am7 → D7 → Gmaj7" */
  label: string;
};

export function approachesTo(
  target: WorkingChord,
  tonicPc: number,
  simple: boolean,
): Approach[] {
  const r = mod12(target.rootPc);
  const minor = isMinorish(target.quality);
  const n = (pc: number) => noteNameFor(pc, tonicPc);

  // the qualities we build the approach out of
  const V: QualityId = simple ? "dom7" : minor ? "dom7b9" : "dom13";
  const SUB: QualityId = simple ? "dom7" : "dom13";
  // in MINOR the ii is half-diminished. This is the distinction most people miss.
  const II: QualityId = minor ? "m7b5" : simple ? "min" : "min9";
  const IV: QualityId = simple ? "min" : "min9";
  const BVII: QualityId = simple ? "dom7" : "dom13";

  const c = (pc: number, q: QualityId) => defaultChord(mod12(pc), q);
  const sym = (pc: number, q: QualityId) => `${n(pc)}${QUALITIES[q].symbol}`;
  const targetSym = `${n(r)}${QUALITIES[target.quality].symbol}`;

  const out: Approach[] = [
    {
      id: "two-five",
      name: "Its ii–V  (the gospel move)",
      why: `Treat ${n(r)} as a temporary tonic and play ITS own ii–V. ${sym(r + 2, II)} → ${sym(r + 7, V)} → ${targetSym}. Neither of those chords belongs to your key — that's the point. It makes ${n(r)} feel like an arrival instead of just the next chord.${minor ? " Note the ii is HALF-DIMINISHED, because the target is minor." : ""}`,
      chords: [c(r + 2, II), c(r + 7, V)],
      label: `${sym(r + 2, II)} → ${sym(r + 7, V)} → ${targetSym}`,
    },
    {
      id: "five",
      name: "Its V  (secondary dominant)",
      why: `Just the dominant. ${sym(r + 7, V)} pulls into ${n(r)} whether or not it belongs to the key. The cheapest way to make any chord sound intentional.`,
      chords: [c(r + 7, V)],
      label: `${sym(r + 7, V)} → ${targetSym}`,
    },
    {
      id: "sub",
      name: "Tritone sub of its V",
      why: `${sym(r + 1, SUB)} shares its 3rd and 7th with ${sym(r + 7, V)} — same pull, but now the bass slides DOWN a half-step into ${n(r)}. Swap it in anywhere the plain V feels obvious.`,
      chords: [c(r + 1, SUB)],
      label: `${sym(r + 1, SUB)} → ${targetSym}`,
    },
    {
      id: "two-sub",
      name: "ii–V with the tritone sub",
      why: `The full set-up, but the dominant is subbed. The bass walks ${n(r + 2)} → ${n(r + 1)} → ${n(r)} — down by a half-step at the end. This is the sound of a piano player showing off.`,
      chords: [c(r + 2, II), c(r + 1, SUB)],
      label: `${sym(r + 2, II)} → ${sym(r + 1, SUB)} → ${targetSym}`,
    },
    {
      id: "sus",
      name: "Vsus → V  (delay it)",
      why: `Hold the 4th over the dominant, then drop it into the 3rd, then land. A resolution inside the resolution — very gospel, very church.`,
      chords: [c(r + 7, "dom7sus"), c(r + 7, V)],
      label: `${sym(r + 7, "dom7sus")} → ${sym(r + 7, V)} → ${targetSym}`,
    },
    {
      id: "dim",
      name: "Passing diminished",
      why: `${sym(r - 1, "dim7")} sits a half-step below. The bass just walks chromatically up into ${n(r)} and the °7 harmonises the step. The glue of every gospel walk-up.`,
      chords: [c(r - 1, "dim7")],
      label: `${sym(r - 1, "dim7")} → ${targetSym}`,
    },
    {
      id: "backdoor",
      name: "Backdoor ii–V",
      why: `Approach from the FLAT side instead: ${sym(r + 5, IV)} → ${sym(r + 10, BVII)} → ${n(r)}. The ♭7 of ${n(r + 10)} falls a half-step into the 3rd of ${n(r)}. Softer and more surprising than the front door.`,
      chords: [c(r + 5, IV), c(r + 10, BVII)],
      label: `${sym(r + 5, IV)} → ${sym(r + 10, BVII)} → ${targetSym}`,
    },
    {
      id: "chromatic",
      name: "Chromatic slide",
      why: `The same chord a half-step above, slid down into the target. No theory at all — the ear simply accepts any half-step. Works when nothing else does.`,
      chords: [c(r + 1, target.quality)],
      label: `${sym(r + 1, target.quality)} → ${targetSym}`,
    },
  ];

  return out;
}
