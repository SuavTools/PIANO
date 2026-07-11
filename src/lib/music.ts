// ---------------------------------------------------------------------------
// music.ts — the theory engine
//
// Everything is pure. Progressions are stored relative to the tonic (as
// semitone offsets) so they transpose to any of the 12 keys for free.
// Voicings are stored as semitone offsets from each chord's own root, and can
// exceed an octave — that's what gives the open, stacked neo-soul / jazz sound.
// ---------------------------------------------------------------------------

export type QualityId =
  | "maj9"
  | "maj7"
  | "maj7#11"
  | "6/9"
  | "min9"
  | "min7"
  | "min11"
  | "min6/9"
  | "dom9"
  | "dom13"
  | "dom7#9"
  | "dom7b9"
  | "m7b5"
  | "dim7"
  | "quartal";

type Quality = {
  /** how the chord symbol suffix reads, e.g. "maj9" -> Cmaj9 */
  symbol: string;
  /** semitone offsets from the chord root; may span multiple octaves */
  voicing: number[];
};

// Hand-chosen voicings — open, played the way these genres actually voice them
// (fifth in the left hand, extensions stacked above the third). Not textbook
// root-position triads.
export const QUALITIES: Record<QualityId, Quality> = {
  maj9:      { symbol: "maj9",    voicing: [0, 7, 11, 14, 16] }, // R 5 7 9 3^
  maj7:      { symbol: "maj7",    voicing: [0, 7, 11, 16] },     // R 5 7 3^
  "maj7#11": { symbol: "maj7♯11", voicing: [0, 7, 11, 14, 18] }, // lydian glow
  "6/9":     { symbol: "6/9",     voicing: [0, 7, 9, 14, 16] },  // R 5 6 9 3^
  min9:      { symbol: "m9",      voicing: [0, 7, 10, 14, 15] }, // R 5 ♭7 9 ♭3^
  min7:      { symbol: "m7",      voicing: [0, 7, 10, 15] },     // R 5 ♭7 ♭3^
  min11:     { symbol: "m11",     voicing: [0, 7, 10, 14, 17] }, // R 5 ♭7 9 11
  "min6/9":  { symbol: "m6/9",    voicing: [0, 7, 9, 14, 15] },
  dom9:      { symbol: "9",       voicing: [0, 10, 14, 16] },    // R ♭7 9 3^
  dom13:     { symbol: "13",      voicing: [0, 10, 16, 21] },    // R ♭7 3^ 13
  "dom7#9":  { symbol: "7♯9",     voicing: [0, 4, 10, 15] },     // the Hendrix
  "dom7b9":  { symbol: "7♭9",     voicing: [0, 4, 10, 13] },
  m7b5:      { symbol: "ø7",      voicing: [0, 6, 10, 15] },
  dim7:      { symbol: "°7",      voicing: [0, 3, 6, 9] },
  quartal:   { symbol: "sus",     voicing: [0, 5, 10, 15] },     // stacked 4ths
};

export type ChordSpec = {
  /** semitones of this chord's root above the tonic */
  offset: number;
  quality: QualityId;
  /** roman-numeral label, authored per chord so it's always spelled right */
  roman: string;
};

export type Progression = {
  id: string;
  name: string;
  blurb: string;
  chords: ChordSpec[];
};

export type Style = {
  id: string;
  name: string;
  tagline: string;
  progressions: Progression[];
};

// ---------------------------------------------------------------------------
// The styles. Each progression is a real, playable move in that idiom.
// ---------------------------------------------------------------------------
export const STYLES: Style[] = [
  {
    id: "neosoul",
    name: "Neo-Soul",
    tagline: "D'Angelo · Dilla · Hiatus",
    progressions: [
      {
        id: "voyager",
        name: "Voyager",
        blurb: "Imaj9 · IVmaj9 · iii · vi — floating, unhurried",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 5, quality: "maj9", roman: "IVmaj9" },
          { offset: 4, quality: "min9", roman: "iii9" },
          { offset: 9, quality: "min9", roman: "vi9" },
        ],
      },
      {
        id: "sunday",
        name: "Sunday Morning",
        blurb: "I · vi · ii · V with lush ninths",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 9, quality: "min9", roman: "vi9" },
          { offset: 2, quality: "min9", roman: "ii9" },
          { offset: 7, quality: "dom13", roman: "V13" },
        ],
      },
      {
        id: "backdoor",
        name: "Back Door",
        blurb: "I · ♭VII · IV — that gospel-soul lift",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 10, quality: "dom9", roman: "♭VII9" },
          { offset: 5, quality: "maj9", roman: "IVmaj9" },
          { offset: 0, quality: "6/9", roman: "I6/9" },
        ],
      },
    ],
  },
  {
    id: "glasper",
    name: "Glasper",
    tagline: "modal · quartal · suspended",
    progressions: [
      {
        id: "drift",
        name: "Quartal Drift",
        blurb: "i · IVsus · ♭VII · ♭III — stacked fourths, no gravity",
        chords: [
          { offset: 0, quality: "min11", roman: "i11" },
          { offset: 5, quality: "quartal", roman: "IVsus" },
          { offset: 10, quality: "maj9", roman: "♭VIIΔ" },
          { offset: 3, quality: "maj7#11", roman: "♭IIIΔ♯11" },
        ],
      },
      {
        id: "cherish",
        name: "Cherish",
        blurb: "Imaj7♯11 · ii11 · vi · IV — lydian shimmer",
        chords: [
          { offset: 0, quality: "maj7#11", roman: "Imaj7♯11" },
          { offset: 2, quality: "min11", roman: "ii11" },
          { offset: 9, quality: "min9", roman: "vi9" },
          { offset: 5, quality: "maj9", roman: "IVmaj9" },
        ],
      },
    ],
  },
  {
    id: "rnb",
    name: "R&B",
    tagline: "slow jams · quiet storm",
    progressions: [
      {
        id: "slowjam",
        name: "Slow Jam",
        blurb: "I · vi · iii · V — velvet and patient",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 9, quality: "min9", roman: "vi9" },
          { offset: 4, quality: "min9", roman: "iii9" },
          { offset: 7, quality: "dom9", roman: "V9" },
        ],
      },
      {
        id: "passing",
        name: "Passing Diminished",
        blurb: "I · ♯I° · ii · V — that chromatic climb",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 1, quality: "dim7", roman: "♯I°7" },
          { offset: 2, quality: "min9", roman: "ii9" },
          { offset: 7, quality: "dom13", roman: "V13" },
        ],
      },
    ],
  },
  {
    id: "jazz",
    name: "Jazz",
    tagline: "ii–V–I · turnarounds · altered",
    progressions: [
      {
        id: "iiVI",
        name: "The ii–V–I",
        blurb: "ii · V♭9 · I · VI♯9 — home, and back out again",
        chords: [
          { offset: 2, quality: "min9", roman: "ii9" },
          { offset: 7, quality: "dom7b9", roman: "V7♭9" },
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 9, quality: "dom7#9", roman: "VI7♯9" },
        ],
      },
      {
        id: "minoriiV",
        name: "Minor ii–V–i",
        blurb: "iiø7 · V♭9 · i — noir and unresolved",
        chords: [
          { offset: 2, quality: "m7b5", roman: "iiø7" },
          { offset: 7, quality: "dom7b9", roman: "V7♭9" },
          { offset: 0, quality: "min9", roman: "i9" },
          { offset: 0, quality: "min6/9", roman: "i6/9" },
        ],
      },
      {
        id: "rhythm",
        name: "Rhythm Turnaround",
        blurb: "I · VI♭9 · ii · V — the engine of a thousand tunes",
        chords: [
          { offset: 0, quality: "maj9", roman: "Imaj9" },
          { offset: 9, quality: "dom7b9", roman: "VI7♭9" },
          { offset: 2, quality: "min9", roman: "ii9" },
          { offset: 7, quality: "dom13", roman: "V13" },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Keys & note spelling
// ---------------------------------------------------------------------------
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES  = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// pitch classes that read more naturally with sharps
const SHARP_KEYS = new Set([0, 7, 2, 9, 4, 11, 6]); // C G D A E B F♯

export type Key = { pc: number; name: string };

export const KEYS: Key[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((pc) => ({
  pc,
  name: (SHARP_KEYS.has(pc) ? SHARP_NAMES : FLAT_NAMES)[pc],
}));

function nameFor(pc: number, tonicPc: number): string {
  const table = SHARP_KEYS.has(tonicPc) ? SHARP_NAMES : FLAT_NAMES;
  return table[((pc % 12) + 12) % 12];
}

// ---------------------------------------------------------------------------
// Building an actual chord in a key
// ---------------------------------------------------------------------------
export type Note = { midi: number; pc: number; name: string; isRoot: boolean };

export type BuiltChord = {
  roman: string;
  /** full chord symbol, e.g. "E♭maj9" */
  symbol: string;
  rootName: string;
  notes: Note[];
};

// C3 = MIDI 48 anchors the tonic; voicings climb from there into a comfy range.
const TONIC_BASE_MIDI = 48;

export function buildChord(spec: ChordSpec, tonicPc: number): BuiltChord {
  const rootMidi = TONIC_BASE_MIDI + tonicPc + spec.offset;
  const q = QUALITIES[spec.quality];
  const notes: Note[] = q.voicing.map((iv, i) => {
    const midi = rootMidi + iv;
    const pc = ((midi % 12) + 12) % 12;
    return { midi, pc, name: nameFor(pc, tonicPc), isRoot: i === 0 };
  });
  const rootName = nameFor(((rootMidi % 12) + 12) % 12, tonicPc);
  return {
    roman: spec.roman,
    symbol: `${rootName}${q.symbol}`,
    rootName,
    notes,
  };
}

export function buildProgression(prog: Progression, tonicPc: number): BuiltChord[] {
  return prog.chords.map((c) => buildChord(c, tonicPc));
}

// ---------------------------------------------------------------------------
// Keyboard range — shared across every card in a progression so the shapes
// are directly comparable. Snap outward to C boundaries, with a little air.
// ---------------------------------------------------------------------------
export type KeyRange = { low: number; high: number };

export function rangeForChords(chords: BuiltChord[]): KeyRange {
  let min = Infinity;
  let max = -Infinity;
  for (const ch of chords) {
    for (const n of ch.notes) {
      if (n.midi < min) min = n.midi;
      if (n.midi > max) max = n.midi;
    }
  }
  if (!isFinite(min)) return { low: 48, high: 72 };
  // snap down/up to the nearest C, with one buffer semitone of padding
  const low = Math.floor((min - 1) / 12) * 12;
  const high = Math.ceil((max + 1) / 12) * 12;
  return { low, high };
}

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
export const isWhite = (midi: number) => WHITE_PCS.has(((midi % 12) + 12) % 12);
