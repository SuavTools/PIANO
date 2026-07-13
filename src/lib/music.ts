// ---------------------------------------------------------------------------
// music.ts — the theory engine
//
// A chord is: absolute root pitch-class + quality + voicing variant + inversion
// + optional slash bass. The tonic is a transpose reference — changing key
// shifts every root, and roman numerals are computed relative to it.
// ---------------------------------------------------------------------------

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export type QualityId =
  // the basics — triads and plain sevenths. Not everything is a 13th.
  | "maj" | "min" | "sus2" | "sus4" | "dom7" | "add9" | "minAdd9"
  // the extended jazz palette
  | "maj9" | "maj7" | "maj7#11" | "6/9"
  | "min9" | "min7" | "min11" | "min6/9" | "minMaj7"
  | "dom9" | "dom13" | "dom7#9" | "dom7b9" | "dom7sus"
  | "m7b5" | "dim7" | "quartal";

export type Variant = { name: string; voicing: number[] };

type QualityDef = {
  label: string;        // menu label
  symbol: string;       // chord-symbol suffix -> Cmaj9
  romanSuffix: string;  // roman suffix -> ii9
  minor: boolean;       // lowercase roman numeral
  variants: Variant[];  // voicing options; [0] is the default
};

// Voicings cap around +23 semitones so even big "Spread" shapes stay readable.
export const QUALITIES: Record<QualityId, QualityDef> = {
  // ---- the basics: plain triads and sevenths. Pop, house and rock live here,
  // and a maj9 is simply the wrong chord for a four-on-the-floor piano stab.
  maj: {
    label: "Major", symbol: "", romanSuffix: "", minor: false,
    variants: [
      { name: "Close", voicing: [0, 4, 7] },
      { name: "Open", voicing: [0, 7, 16] },
      { name: "Spread", voicing: [0, 7, 12, 16, 19] },
      { name: "Stab", voicing: [0, 4, 7, 12] },
    ],
  },
  min: {
    label: "Minor", symbol: "m", romanSuffix: "", minor: true,
    variants: [
      { name: "Close", voicing: [0, 3, 7] },
      { name: "Open", voicing: [0, 7, 15] },
      { name: "Spread", voicing: [0, 7, 12, 15, 19] },
      { name: "Stab", voicing: [0, 3, 7, 12] },
    ],
  },
  sus2: {
    label: "Sus2", symbol: "sus2", romanSuffix: "sus2", minor: false,
    variants: [
      { name: "Close", voicing: [0, 2, 7] },
      { name: "Open", voicing: [0, 7, 14] },
      { name: "Spread", voicing: [0, 7, 14, 19] },
    ],
  },
  sus4: {
    label: "Sus4", symbol: "sus4", romanSuffix: "sus4", minor: false,
    variants: [
      { name: "Close", voicing: [0, 5, 7] },
      { name: "Open", voicing: [0, 7, 17] },
      { name: "Spread", voicing: [0, 7, 12, 17] },
    ],
  },
  dom7: {
    label: "Dominant 7", symbol: "7", romanSuffix: "7", minor: false,
    variants: [
      { name: "Close", voicing: [0, 4, 7, 10] },
      { name: "Open", voicing: [0, 7, 10, 16] },
      { name: "Shell", voicing: [0, 10, 16] },
    ],
  },
  add9: {
    label: "Add 9", symbol: "add9", romanSuffix: "add9", minor: false,
    variants: [
      { name: "Open", voicing: [0, 7, 14, 16] },
      { name: "Close", voicing: [0, 4, 7, 14] },
      { name: "Shimmer", voicing: [0, 7, 12, 14, 16] },
    ],
  },
  minAdd9: {
    label: "Minor add 9", symbol: "m(add9)", romanSuffix: "add9", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 14, 15] },
      { name: "Close", voicing: [0, 3, 7, 14] },
      { name: "Shimmer", voicing: [0, 7, 12, 14, 15] },
    ],
  },

  // ---- the extended palette
  maj9: {
    label: "Major 9", symbol: "maj9", romanSuffix: "maj9", minor: false,
    variants: [
      { name: "Open", voicing: [0, 7, 11, 14, 16] },
      { name: "Rootless", voicing: [4, 7, 11, 14] },
      { name: "Spread", voicing: [0, 11, 14, 19, 23] },
      { name: "Shell", voicing: [0, 11, 16] },
    ],
  },
  maj7: {
    label: "Major 7", symbol: "maj7", romanSuffix: "maj7", minor: false,
    variants: [
      { name: "Open", voicing: [0, 7, 11, 16] },
      { name: "Close", voicing: [0, 4, 7, 11] },
      { name: "Shell", voicing: [0, 11, 16] },
    ],
  },
  "maj7#11": {
    label: "Maj7♯11", symbol: "maj7♯11", romanSuffix: "maj7♯11", minor: false,
    variants: [
      { name: "Lydian", voicing: [0, 7, 11, 14, 18] },
      { name: "Rootless", voicing: [4, 11, 14, 18] },
      { name: "Spread", voicing: [0, 11, 14, 18, 23] },
    ],
  },
  "6/9": {
    label: "6/9", symbol: "6/9", romanSuffix: "6/9", minor: false,
    variants: [
      { name: "Open", voicing: [0, 7, 9, 14, 16] },
      { name: "Close", voicing: [0, 4, 9, 14] },
      { name: "Spread", voicing: [0, 9, 14, 16, 19] },
    ],
  },
  min9: {
    label: "Minor 9", symbol: "m9", romanSuffix: "9", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 10, 14, 15] },
      { name: "Rootless", voicing: [3, 7, 10, 14] },
      { name: "Spread", voicing: [0, 10, 15, 19, 22] },
      { name: "Shell", voicing: [0, 10, 15] },
    ],
  },
  min7: {
    label: "Minor 7", symbol: "m7", romanSuffix: "7", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 10, 15] },
      { name: "Close", voicing: [0, 3, 7, 10] },
      { name: "Shell", voicing: [0, 10, 15] },
    ],
  },
  min11: {
    label: "Minor 11", symbol: "m11", romanSuffix: "11", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 10, 14, 17] },
      { name: "Quartal", voicing: [0, 5, 10, 15, 17] },
      { name: "Rootless", voicing: [3, 7, 10, 14, 17] },
    ],
  },
  "min6/9": {
    label: "Minor 6/9", symbol: "m6/9", romanSuffix: "6/9", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 9, 14, 15] },
      { name: "Close", voicing: [0, 3, 9, 14] },
    ],
  },
  minMaj7: {
    label: "Minor(maj7)", symbol: "m(maj7)", romanSuffix: "(maj7)", minor: true,
    variants: [
      { name: "Open", voicing: [0, 7, 11, 15] },
      { name: "Close", voicing: [0, 3, 7, 11] },
    ],
  },
  dom9: {
    label: "Dominant 9", symbol: "9", romanSuffix: "9", minor: false,
    variants: [
      { name: "Open", voicing: [0, 10, 14, 16] },
      { name: "Rootless", voicing: [4, 10, 14] },
      { name: "Full", voicing: [0, 4, 10, 14] },
    ],
  },
  dom13: {
    label: "Dominant 13", symbol: "13", romanSuffix: "13", minor: false,
    variants: [
      { name: "Shell", voicing: [0, 10, 16, 21] },
      { name: "Rootless", voicing: [4, 10, 14, 21] },
      { name: "Full", voicing: [0, 4, 10, 16, 21] },
    ],
  },
  "dom7#9": {
    label: "Dominant 7♯9", symbol: "7♯9", romanSuffix: "7♯9", minor: false,
    variants: [
      { name: "Hendrix", voicing: [0, 4, 10, 15] },
      { name: "Rootless", voicing: [4, 10, 15, 18] },
    ],
  },
  "dom7b9": {
    label: "Dominant 7♭9", symbol: "7♭9", romanSuffix: "7♭9", minor: false,
    variants: [
      { name: "Close", voicing: [0, 4, 10, 13] },
      { name: "Altered", voicing: [4, 10, 13, 18] },
    ],
  },
  dom7sus: {
    label: "Dominant 7sus4", symbol: "7sus4", romanSuffix: "7sus4", minor: false,
    variants: [
      { name: "Open", voicing: [0, 7, 10, 17] },
      { name: "Slash-style", voicing: [0, 10, 14, 17] },
    ],
  },
  m7b5: {
    label: "Half-dim ø7", symbol: "ø7", romanSuffix: "ø7", minor: true,
    variants: [
      { name: "Open", voicing: [0, 6, 10, 15] },
      { name: "Close", voicing: [0, 3, 6, 10] },
    ],
  },
  dim7: {
    label: "Diminished °7", symbol: "°7", romanSuffix: "°7", minor: true,
    variants: [
      { name: "Close", voicing: [0, 3, 6, 9] },
      { name: "Spread", voicing: [0, 6, 9, 15] },
    ],
  },
  quartal: {
    label: "Quartal sus", symbol: "sus", romanSuffix: "sus", minor: false,
    variants: [
      { name: "4ths", voicing: [0, 5, 10, 15] },
      { name: "Tall 4ths", voicing: [0, 5, 10, 15, 20] },
    ],
  },
};

export const QUALITY_ORDER: QualityId[] = [
  "maj", "min", "sus2", "sus4", "dom7", "add9", "minAdd9",
  "maj9", "maj7", "maj7#11", "6/9",
  "min9", "min7", "min11", "min6/9", "minMaj7",
  "dom9", "dom13", "dom7#9", "dom7b9", "dom7sus",
  "m7b5", "dim7", "quartal",
];

// ---------------------------------------------------------------------------
// Scales — which scales actually work over each chord quality.
// Intervals are semitones from the CHORD's root.
// ---------------------------------------------------------------------------
export type Scale = { name: string; intervals: number[]; degrees: string[]; note: string };

const S = {
  ionian:      { name: "Ionian (major)",   intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ["1","2","3","4","5","6","7"], note: "The home sound. Careful with the 4th over a maj7." },
  lydian:      { name: "Lydian",           intervals: [0, 2, 4, 6, 7, 9, 11], degrees: ["1","2","3","♯4","5","6","7"], note: "Raised 4th — floats, never resolves. The neo-soul major." },
  majPent:     { name: "Major pentatonic", intervals: [0, 2, 4, 7, 9],        degrees: ["1","2","3","5","6"], note: "No half-steps, no wrong notes. Safe and singable." },
  dorian:      { name: "Dorian",           intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ["1","2","♭3","4","5","6","♭7"], note: "Minor with a natural 6 — the default minor of soul and jazz." },
  aeolian:     { name: "Aeolian (natural minor)", intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ["1","2","♭3","4","5","♭6","♭7"], note: "Darker than Dorian; the ♭6 pulls down." },
  minPent:     { name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10],       degrees: ["1","♭3","4","5","♭7"], note: "The bones of blues and soul phrasing." },
  blues:       { name: "Blues scale",      intervals: [0, 3, 5, 6, 7, 10],    degrees: ["1","♭3","4","♭5","5","♭7"], note: "Minor pentatonic + the ♭5 passing note." },
  mixo:        { name: "Mixolydian",       intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ["1","2","3","4","5","6","♭7"], note: "The plain dominant sound. Gospel and blues live here." },
  lydDom:      { name: "Lydian dominant",  intervals: [0, 2, 4, 6, 7, 9, 10], degrees: ["1","2","3","♯11","5","6","♭7"], note: "Mixolydian with a ♯11 — dominant, but hip." },
  altered:     { name: "Altered (super-locrian)", intervals: [0, 1, 3, 4, 6, 8, 10], degrees: ["1","♭9","♯9","3","♯11","♭13","♭7"], note: "Every tension at once. Maximum pull back to the I." },
  halfWhole:   { name: "Half-whole diminished", intervals: [0, 1, 3, 4, 6, 7, 9, 10], degrees: ["1","♭9","♯9","3","♯11","5","13","♭7"], note: "♭9, ♯9 and ♯11 available — the symmetric dominant." },
  wholeHalf:   { name: "Whole-half diminished", intervals: [0, 2, 3, 5, 6, 8, 9, 11], degrees: ["1","2","♭3","4","♭5","♭6","6","7"], note: "The scale of the °7 chord itself." },
  locrian:     { name: "Locrian",          intervals: [0, 1, 3, 5, 6, 8, 10], degrees: ["1","♭2","♭3","4","♭5","♭6","♭7"], note: "The ø7 default — but the ♭2 is brittle." },
  locrian2:    { name: "Locrian ♮2",       intervals: [0, 2, 3, 5, 6, 8, 10], degrees: ["1","2","♭3","4","♭5","♭6","♭7"], note: "Locrian with a natural 9. Far more usable over ø7." },
  melMinor:    { name: "Melodic minor",    intervals: [0, 2, 3, 5, 7, 9, 11], degrees: ["1","2","♭3","4","5","6","7"], note: "Minor with a major 7 — tense, cinematic." },
  harmMinor:   { name: "Harmonic minor",   intervals: [0, 2, 3, 5, 7, 8, 11], degrees: ["1","2","♭3","4","5","♭6","7"], note: "The ♭6-to-♮7 leap gives that classical-minor drama." },
  phrygDom:    { name: "Phrygian dominant", intervals: [0, 1, 4, 5, 7, 8, 10], degrees: ["1","♭9","3","4","5","♭6","♭7"], note: "5th mode of harmonic minor — the V of a minor key." },
} satisfies Record<string, Scale>;

export const SCALES_FOR: Record<QualityId, Scale[]> = {
  maj:       [S.ionian, S.majPent, S.lydian],
  min:       [S.aeolian, S.dorian, S.minPent],
  sus2:      [S.ionian, S.mixo, S.majPent],
  sus4:      [S.mixo, S.dorian],
  dom7:      [S.mixo, S.blues, S.lydDom],
  add9:      [S.ionian, S.majPent, S.lydian],
  minAdd9:   [S.aeolian, S.dorian, S.minPent],
  maj9:      [S.ionian, S.lydian, S.majPent],
  maj7:      [S.ionian, S.lydian],
  "maj7#11": [S.lydian, S.majPent],
  "6/9":     [S.ionian, S.lydian, S.majPent],
  min9:      [S.dorian, S.aeolian, S.minPent],
  min7:      [S.dorian, S.aeolian, S.minPent, S.blues],
  min11:     [S.dorian, S.minPent],
  "min6/9":  [S.dorian, S.melMinor],
  minMaj7:   [S.melMinor, S.harmMinor],
  dom9:      [S.mixo, S.lydDom],
  dom13:     [S.mixo, S.lydDom, S.majPent],
  "dom7#9":  [S.altered, S.halfWhole, S.blues],
  "dom7b9":  [S.halfWhole, S.altered, S.phrygDom],
  dom7sus:   [S.mixo, S.dorian],
  m7b5:      [S.locrian2, S.locrian],
  dim7:      [S.wholeHalf],
  quartal:   [S.mixo, S.dorian],
};

// ---------------------------------------------------------------------------
// A chord in the working progression
// ---------------------------------------------------------------------------
export type WorkingChord = {
  rootPc: number;
  quality: QualityId;
  variant: number;
  inversion: number;       // rotate the voicing upward N times
  bass: number | null;     // slash bass pitch-class; null = none
  scale: number | null;    // index into SCALES_FOR[quality]; null = hidden
  shape: number;           // which guitar grip (E / A / D shape)
  /**
   * UPPER STRUCTURE — a major triad stacked on top of the chord. This is how
   * players actually voice complex harmony: you don't think "add a 9, a ♯11 and
   * a 13", you think "put a D triad over the C7" and all three arrive at once.
   * Stored as the triad's root pitch-class; null = none.
   */
  upper: number | null;
};

export const defaultChord = (rootPc: number, quality: QualityId = "maj9"): WorkingChord => ({
  rootPc, quality, variant: 0, inversion: 0, bass: null, scale: null, shape: 0, upper: null,
});

// ---------------------------------------------------------------------------
// Templates, and the theory behind each genre.
//
// Every progression carries a `movement` note: the actual voice-leading reason
// it works. That's the difference between a list of chords and a lesson.
// ---------------------------------------------------------------------------
export type ChordSpec = { offset: number; quality: QualityId; variant?: number; bass?: number; upper?: number };

export type Progression = {
  id: string;
  name: string;
  blurb: string;
  /** the voice-leading story — what actually moves, and why it lands */
  movement: string;
  chords: ChordSpec[];
};

export type Device = { name: string; what: string };

export type GenreTheory = {
  /** how the genre thinks about harmony */
  approach: string;
  /** what the voices do */
  voiceLeading: string;
  /** what a soloist aims at */
  targets: string;
  /** the scale vocabulary */
  scales: string;
  /** the signature moves */
  devices: Device[];
};

export type Style = {
  id: string;
  name: string;
  tagline: string;
  theory: GenreTheory;
  progressions: Progression[];
};

const c = (offset: number, quality: QualityId, bass?: number): ChordSpec => ({ offset, quality, bass });

export const STYLES: Style[] = [
  // =========================================================================
  {
    id: "neosoul",
    name: "Neo-Soul",
    tagline: "D'Angelo · Dilla · Hiatus Kaiyote · Erykah",
    theory: {
      approach:
        "Neo-soul takes jazz harmony and refuses to resolve it. Everything is a maj9, m9 or 13 — the plain triad is basically banned, because the 9th and 13th are what give the chord its haze. Chords sit still and breathe rather than driving to a cadence, so the interest has to come from colour, not motion.",
      voiceLeading:
        "Hold the top voice still and move everything underneath it. A single common tone kept across three chords is the whole neo-soul sound — it makes the harmony feel like it's drifting rather than stepping. When you do move, move by step, and let the bass wander independently (that's why slash chords are everywhere).",
      targets:
        "The 9th and the 3rd. Land on the 9th and the chord glows; land on the root and it dies. Over minor chords, the 11th is free real estate.",
      scales:
        "Dorian over everything minor. Lydian — not Ionian — over major: the ♯11 is the sound. Major and minor pentatonics for melody, because they never step on the chord's colour.",
      devices: [
        { name: "Rootless voicings", what: "Drop the root, let the bass have it. Frees your hand to stack 9ths and 13ths." },
        { name: "Slash chords / pedals", what: "Keep one bass note while the chords move above it. Instant tension without any harmonic effort." },
        { name: "The ♭VII", what: "Borrowed from the parallel minor. It's the gospel-soul lift — the ♭7 in the bass pulls straight home." },
        { name: "Chromatic slides", what: "Slide a whole voicing up or down a half-step into the target. No theory needed — the ear buys it." },
      ],
    },
    progressions: [
      { id: "voyager", name: "Voyager", blurb: "I · IV · iii · vi — floating, unhurried",
        movement: "C and E are held right through all four chords — that's why it drifts instead of moving. Only the bass really travels.",
        chords: [c(0, "maj9"), c(5, "maj9"), c(4, "min9"), c(9, "min9")] },
      { id: "sunday", name: "Sunday Morning", blurb: "I · vi · ii · V with lush ninths",
        movement: "The classic circle: each root falls a fifth, and the 7th of every chord drops a half-step into the 3rd of the next.",
        chords: [c(0, "maj9"), c(9, "min9"), c(2, "min9"), c(7, "dom13")] },
      { id: "backdoor-soul", name: "Back Door Lift", blurb: "I · ♭VII · IV — the gospel-soul lift",
        movement: "♭VII is borrowed from the parallel minor. Its ♭7 falls a half-step into the 3rd of IV — the lift you feel in every gospel record.",
        chords: [c(0, "maj9"), c(10, "dom9"), c(5, "maj9"), c(0, "6/9")] },
      { id: "velvet", name: "Velvet Descent", blurb: "iii · vi · ii · V — falling fifths, all ninths",
        movement: "Four chords, roots falling by fifths, every 7th resolving down a half-step into the next 3rd. The smoothest motion in music.",
        chords: [c(4, "min9"), c(9, "min9"), c(2, "min9"), c(7, "dom13")] },
      { id: "pedal", name: "Tonic Pedal", blurb: "Everything over the tonic in the bass",
        movement: "The bass refuses to move while the harmony walks away from it. Every chord becomes a slash chord and the tension builds for free.",
        chords: [c(0, "maj9", 0), c(5, "maj9", 0), c(10, "maj9", 0), c(7, "dom13", 0)] },
      { id: "inversion-soul", name: "Rising Bass", blurb: "I · I/3 · IV · IV/5 — the bass walks up",
        movement: "The chords barely change; the bass climbs underneath them. All the movement is in the lowest voice.",
        chords: [c(0, "maj9"), c(0, "maj9", 4), c(5, "maj9"), c(5, "maj9", 0)] },
      { id: "ascension", name: "Ascension", blurb: "I · ii · iii · IV — walking up the scale",
        movement: "Stepwise roots. Nothing clever — but keep the top voice on the tonic and it turns into a rising wall.",
        chords: [c(0, "maj9"), c(2, "min9"), c(4, "min9"), c(5, "maj9")] },
      { id: "dilla", name: "Dilla Drift", blurb: "I · ♭III · ♭VI · ♭VII — all borrowed",
        movement: "Every chord after the first is stolen from the parallel minor. They're all major, so it lifts rather than darkens.",
        chords: [c(0, "maj9"), c(3, "maj9"), c(8, "maj9"), c(10, "dom9")] },
      { id: "cranes", name: "Cranes", blurb: "I · iii · vi · IV — the sad-pretty loop",
        movement: "I to iii shares two notes — it's almost the same chord with a new bass. That near-identity is what makes it ache.",
        chords: [c(0, "maj9"), c(4, "min9"), c(9, "min9"), c(5, "maj9")] },
      { id: "kaiyote", name: "Lydian Shift", blurb: "Imaj7♯11 · ♭VIImaj7♯11 — planing",
        movement: "The same shape slid down a whole step. Planing: don't voice-lead at all, just move the whole hand. Very Hiatus Kaiyote.",
        chords: [c(0, "maj7#11"), c(10, "maj7#11"), c(0, "maj7#11"), c(10, "maj7#11")] },
      { id: "erykah", name: "Two-Chord Vamp", blurb: "i9 · IV13 — sit in it forever",
        movement: "Dorian vamp. The ♮6 of Dorian is the 3rd of the IV chord — that shared note is why you can loop it endlessly.",
        chords: [c(0, "min9"), c(5, "dom13"), c(0, "min9"), c(5, "dom13")] },
      { id: "soul251", name: "Soul 2-5-1", blurb: "ii11 · V13 · Imaj9 · IVmaj9",
        movement: "A ii–V–I that lands and then keeps going to IV instead of stopping. Refusing the cadence is the point.",
        chords: [c(2, "min11"), c(7, "dom13"), c(0, "maj9"), c(5, "maj9")] },
    ],
  },

  // =========================================================================
  {
    id: "glasper",
    name: "Glasper / Modal",
    tagline: "quartal · suspended · no gravity",
    theory: {
      approach:
        "Modal harmony throws out the cadence. Instead of chords pulling toward a tonic, you get one mode you live inside, and chords that colour it. Because nothing resolves, the ear stops predicting — which is exactly the hypnotic quality Glasper, Herbie and McCoy are after.",
      voiceLeading:
        "Stop voice-leading and start PLANING: move the whole shape in parallel and let it land wherever it lands. Quartal voicings (stacked 4ths) are perfect for this because they're ambiguous — they don't declare a major or minor 3rd, so they don't demand resolution.",
      targets:
        "The 4th, the 9th and the 11th — the notes that AREN'T the 3rd. Avoid the 3rd and the chord stays open and unresolved.",
      scales:
        "Dorian and Mixolydian for the suspended sound. Lydian over major. Pentatonics stacked in 4ths — play a pentatonic from the 2nd or 5th of the chord and you get instant modern colour.",
      devices: [
        { name: "Quartal voicings", what: "Stack 4ths instead of 3rds. No 3rd means no major/minor commitment — pure ambiguity." },
        { name: "Planing", what: "Slide the identical shape up or down. Parallel motion, which classical harmony forbids and modal music lives on." },
        { name: "Sus chords", what: "The 4th replaces the 3rd and simply never resolves. Suspension as a destination, not a delay." },
        { name: "Side-slipping", what: "Shift the whole thing a half-step out and back. Tension from distance, not from function." },
      ],
    },
    progressions: [
      { id: "drift", name: "Quartal Drift", blurb: "i · IVsus · ♭VII · ♭III",
        movement: "Stacked fourths, no 3rds anywhere. Nothing resolves because nothing has anywhere to go.",
        chords: [c(0, "min11"), c(5, "quartal"), c(10, "maj9"), c(3, "maj7#11")] },
      { id: "cherish", name: "Cherish", blurb: "Imaj7♯11 · ii11 · vi · IV",
        movement: "The ♯11 sits a tritone from the root and just hangs there. Lydian shimmer.",
        chords: [c(0, "maj7#11"), c(2, "min11"), c(9, "min9"), c(5, "maj9")] },
      { id: "suspend", name: "Suspended Motion", blurb: "Sus chords that never land",
        movement: "Every chord has a 4th where its 3rd should be. The suspension IS the destination.",
        chords: [c(0, "dom7sus"), c(10, "dom7sus"), c(5, "quartal"), c(3, "maj7#11")] },
      { id: "modal-vamp", name: "Dorian Vamp", blurb: "i11 · IV9 — two chords, infinite time",
        movement: "The ♮6 of Dorian is the 3rd of IV. One shared note lets you loop this forever.",
        chords: [c(0, "min11"), c(5, "dom9"), c(0, "min11"), c(5, "dom9")] },
      { id: "sowhat", name: "So What", blurb: "i11 · ♭II11 — up a half-step and back",
        movement: "Miles' trick: take the whole quartal shape up a semitone, then bring it back. Same voicing, new world.",
        chords: [c(0, "min11"), c(1, "min11"), c(0, "min11"), c(0, "min11")] },
      { id: "maiden", name: "Maiden Voyage", blurb: "sus chords drifting in fourths",
        movement: "Herbie's sus voyage — roots move by 4ths, the sus quality never breaks. No cadence, ever.",
        chords: [c(0, "dom7sus"), c(5, "dom7sus"), c(3, "dom7sus"), c(8, "dom7sus")] },
      { id: "sideslip", name: "Side-Slip", blurb: "Imaj9 · ♭IImaj9 · Imaj9 — out and back",
        movement: "Step the whole chord a semitone away from home and immediately back. Tension purely from distance.",
        chords: [c(0, "maj9"), c(1, "maj9"), c(0, "maj9"), c(0, "6/9")] },
    ],
  },

  // =========================================================================
  {
    id: "rnb",
    name: "R&B / Gospel",
    tagline: "slow jams · quiet storm · church",
    theory: {
      approach:
        "Gospel and R&B harmony is jazz harmony with the brakes off — it goes to the same places but it gets there by filling every gap with a passing chord. The bass is a melody in its own right, and the harmony is dense: 9ths, 13ths, and diminished chords used purely as glue.",
      voiceLeading:
        "Fill in every crack. If two chords are a whole step apart, put a diminished chord between them. Keep the top voice singing a line of its own, and walk the bass in steps — the chords are almost a by-product of the two outer voices moving.",
      targets:
        "The 3rd, and the 6th (the 13th). Gospel loves the 6/9 chord because it's a resolution that still has colour.",
      scales:
        "Major pentatonic and the blues scale, side by side. Mixolydian over the dominants. The trick is mixing the major 3rd and the ♭3 freely — that clash IS the gospel/blues sound.",
      devices: [
        { name: "Passing diminished", what: "The ♯I°7 between I and ii. It's just a chromatic bass step that got harmonised." },
        { name: "The 6/9 chord", what: "A tonic that's landed but hasn't gone flat. Ends a phrase without killing it." },
        { name: "Walk-ups", what: "I · I/3 · IV — the bass climbs the scale and the chords follow. The whole church tradition in one move." },
        { name: "Borrowed iv", what: "The minor iv in a major key. The ache in every soul ballad." },
      ],
    },
    progressions: [
      { id: "slowjam", name: "Slow Jam", blurb: "I · vi · iii · V — velvet and patient",
        movement: "I and vi share two notes; iii shares two with I. Barely anything moves — that's why it's smooth.",
        chords: [c(0, "maj9"), c(9, "min9"), c(4, "min9"), c(7, "dom9")] },
      { id: "passing", name: "Passing Diminished", blurb: "I · ♯I° · ii · V",
        movement: "The °7 is just the bass stepping chromatically from I to ii and getting harmonised on the way.",
        chords: [c(0, "maj9"), c(1, "dim7"), c(2, "min9"), c(7, "dom13")] },
      { id: "gospel251", name: "Gospel 2-5-1", blurb: "ii · V · I landing on the 6/9",
        movement: "Textbook ii–V, but it lands on a 6/9 instead of a maj7 — resolved, but still glowing.",
        chords: [c(2, "min9"), c(7, "dom13"), c(0, "6/9"), c(0, "maj9")] },
      { id: "amen", name: "Amen (Plagal)", blurb: "IV · I, then the minor iv",
        movement: "The plagal cadence, then the borrowed minor iv — its ♭6 falls a half-step into the 5th of I. That's the ache.",
        chords: [c(5, "maj9"), c(0, "maj9", 0), c(5, "min9"), c(0, "maj9")] },
      { id: "quietstorm", name: "Quiet Storm", blurb: "vi · ii · V · I",
        movement: "The full circle of fifths home. Every 7th falls a half-step to the next 3rd — four times in a row.",
        chords: [c(9, "min9"), c(2, "min9"), c(7, "dom13"), c(0, "maj9")] },
      { id: "walkup", name: "Church Walk-Up", blurb: "I · I/3 · IV · ♯IV° · I/5",
        movement: "The bass climbs C–E–F–F♯–G while the chords just follow it. Bass-first harmony.",
        chords: [c(0, "maj9"), c(0, "maj9", 4), c(5, "maj9"), c(6, "dim7"), c(0, "maj9", 7)] },
      { id: "sixtwofive", name: "6-2-5-1", blurb: "VI7 · ii · V · I — the gospel turnaround",
        movement: "VI is made a DOMINANT (not minor) so it pulls hard into ii. A secondary dominant — V of ii.",
        chords: [c(9, "dom7b9"), c(2, "min9"), c(7, "dom13"), c(0, "6/9")] },
      { id: "borrowediv", name: "Borrowed iv", blurb: "I · IV · iv · I — major then minor",
        movement: "The same chord twice, major then minor. The ♭6 dropping to the 5th of I is the saddest half-step in pop.",
        chords: [c(0, "maj9"), c(5, "maj9"), c(5, "min9"), c(0, "maj9")] },
      { id: "shout", name: "Shout Vamp", blurb: "I · IV/I — the church stomp",
        movement: "IV over a tonic pedal. The bass never moves, so it can go forever and the drummer takes over.",
        chords: [c(0, "6/9"), c(5, "maj9", 0), c(0, "6/9"), c(5, "maj9", 0)] },
    ],
  },

  // =========================================================================
  {
    id: "jazz",
    name: "Jazz",
    tagline: "ii–V–I · turnarounds · altered",
    theory: {
      approach:
        "Jazz harmony is one idea repeated at every scale: TENSION, then RELEASE. The ii–V–I is the atom. Everything else — substitutions, turnarounds, whole tunes — is that atom stretched, disguised or chained together. Learn to see every bar as 'where's the V, and where's it going?'",
      voiceLeading:
        "It's all in the guide tones — the 3rd and the 7th. Between any two chords a fifth apart, the 7th of the first falls a HALF-STEP into the 3rd of the second, and vice versa. That single semitone is the engine. Keep those two voices connected and you can drop the roots entirely.",
      targets:
        "The 3rd and 7th, always. And critically: aim at the 3rd of the chord you're going TO, landing on it exactly as the chord changes. That's the whole bebop language.",
      scales:
        "One scale per chord: Dorian over minor, Mixolydian over dominant, Ionian/Lydian over major. Over an ALTERED dominant, use the altered scale — every tension at once, maximum pull home.",
      devices: [
        { name: "Tritone substitution", what: "Swap V7 for ♭II7. They share the same 3rd and 7th (a tritone apart either way) — so the guide tones don't change, but the bass slides down chromatically." },
        { name: "Secondary dominants", what: "Make any chord a dominant and it turns into the V of whatever's next. Instant forward motion." },
        { name: "Backdoor ii–V", what: "iv · ♭VII7 · I. Resolves from the flat side instead of from the V. Softer, more surprising." },
        { name: "Enclosure", what: "Surround a target note with its chromatic neighbours before landing on it. The signature bebop melodic device." },
        { name: "Coltrane changes", what: "Move the tonic in major 3rds instead of fifths, ii–V-ing into each one. Brutal, symmetrical, beautiful." },
      ],
    },
    progressions: [
      { id: "iiVI", name: "The ii–V–I", blurb: "ii · V♭9 · I · VI♯9",
        movement: "THE move. The 7th of ii (C) falls a half-step to the 3rd of V (B); the 7th of V (F) falls to the 3rd of I (E). Two semitones, the whole of jazz.",
        chords: [c(2, "min9"), c(7, "dom7b9"), c(0, "maj9"), c(9, "dom7#9")] },
      { id: "minoriiV", name: "Minor ii–V–i", blurb: "iiø7 · V♭9 · i",
        movement: "Same engine in minor. The ø7 gives a ♭5 that already leans toward the V's ♭9. Noir.",
        chords: [c(2, "m7b5"), c(7, "dom7b9"), c(0, "min9"), c(0, "min6/9")] },
      { id: "rhythm", name: "Rhythm Turnaround", blurb: "I · VI · ii · V",
        movement: "The engine of a thousand tunes. VI is a dominant so it drives to ii, which drives to V, which drives home.",
        chords: [c(0, "maj9"), c(9, "dom7b9"), c(2, "min9"), c(7, "dom13")] },
      { id: "tritone", name: "Tritone Sub", blurb: "ii · ♭II13 · I",
        movement: "♭II13 replaces V7. They share the SAME 3rd and 7th — so nothing changes up top, but the bass now slides D♭→C by a half-step.",
        chords: [c(2, "min9"), c(1, "dom13"), c(0, "maj9"), c(0, "6/9")] },
      { id: "giant", name: "Giant Steps Cycle", blurb: "Coltrane's major-thirds cycle",
        movement: "The tonic moves in major 3rds instead of fifths, with a dominant pushing into each one. Symmetrical and merciless.",
        chords: [c(0, "maj7"), c(3, "dom9"), c(8, "maj7"), c(11, "dom9"), c(4, "maj7")] },
      { id: "autumn", name: "Autumn Leaves", blurb: "the relative major/minor loop",
        movement: "A major ii–V–I, then the SAME move in the relative minor. Two keys, one set of notes.",
        chords: [c(2, "min9"), c(7, "dom13"), c(0, "maj9"), c(5, "maj9"), c(11, "m7b5"), c(4, "dom7b9"), c(9, "min9")] },
      { id: "linecliche", name: "Line Cliché", blurb: "i · i(maj7) · i7 · i6",
        movement: "The chord never changes — one inner voice creeps down chromatically: root, 7, ♭7, 6. Hitchcock harmony.",
        chords: [c(0, "min9"), c(0, "minMaj7"), c(0, "min7"), c(0, "min6/9")] },
      { id: "ladybird", name: "Lady Bird Turnaround", blurb: "I · ♭III7 · ♭VI7 · ♭II7",
        movement: "Tadd Dameron's turnaround — every chord is a tritone sub, so the roots fall in major 3rds and the bass slides home by a semitone.",
        chords: [c(0, "maj9"), c(3, "dom9"), c(8, "dom9"), c(1, "dom13")] },
      { id: "satindoll", name: "Satin Doll", blurb: "ii–V · ii–V, up a step",
        movement: "The same ii–V shifted up a whole tone. Sequence: play the shape, move it, play it again.",
        chords: [c(2, "min9"), c(7, "dom13"), c(4, "min9"), c(9, "dom13")] },
      { id: "solar", name: "Solar Descent", blurb: "i · ♭VII7 · ♭VImaj7 — stepping down",
        movement: "Miles' descent: the tonic falls a whole step, then another. Each is a mini key-change downward.",
        chords: [c(0, "min9"), c(10, "dom9"), c(8, "maj7"), c(3, "dom13")] },
      { id: "bluebossa", name: "Blue Bossa", blurb: "i · iv · iiø · V♭9 · i",
        movement: "A minor tune that swings to the relative major and back. The ø7 is the hinge.",
        chords: [c(0, "min9"), c(5, "min9"), c(2, "m7b5"), c(7, "dom7b9"), c(0, "min9")] },
      { id: "backdoor-jazz", name: "Backdoor ii–V", blurb: "iv · ♭VII7 · I",
        movement: "Resolves from the FLAT side. The ♭7 of ♭VII7 falls a half-step into the 3rd of I — the back door into home.",
        chords: [c(5, "min9"), c(10, "dom13"), c(0, "maj9"), c(0, "6/9")] },
    ],
  },

  // =========================================================================
  {
    id: "blues",
    name: "Blues",
    tagline: "jazz blues · minor blues · the twelve",
    theory: {
      approach:
        "The blues breaks a rule and builds a language out of it: the I chord is a DOMINANT 7th. In functional harmony that's an unresolved chord, so a blues never really rests — it just keeps rolling. Then you play a minor scale over major chords, and the friction is the whole point.",
      voiceLeading:
        "Minimal. The I7 and IV7 share the ♭7, so you barely move — you just flip a note or two. What moves is the MELODY: the ♭3 rubbing against the major 3rd, the ♭5 sliding into the 5th.",
      targets:
        "The ♭3 (bend it toward the major 3rd), the ♭7, and the ♭5 as a passing note. In jazz blues, the 3rds and 7ths of the ii–V still rule.",
      scales:
        "Minor pentatonic and the blues scale over EVERYTHING, including the major chords. Then mix in Mixolydian over each dominant when you want to sound sweeter. Living between those two is the art.",
      devices: [
        { name: "The dominant tonic", what: "I7 instead of Imaj7. The tune can never fully rest — that's the engine." },
        { name: "The ♯9 chord", what: "Major 3rd and ♭3 in the same chord. The Hendrix chord: the blues clash, harmonised." },
        { name: "Quick change", what: "Go to IV in bar 2 and straight back. Stops the first four bars sitting still." },
        { name: "Turnaround", what: "The last two bars that spin you back to the top: I · VI7 · ii · V." },
      ],
    },
    progressions: [
      { id: "jazzblues", name: "Jazz Blues (head)", blurb: "I13 · IV9 · I13 · I7♯9",
        movement: "I7 and IV7 share the ♭7 — almost nothing moves. The ♯9 at the end is the ♭3 and the 3 fighting inside one chord.",
        chords: [c(0, "dom13"), c(5, "dom9"), c(0, "dom13"), c(0, "dom7#9")] },
      { id: "bluesturn", name: "Blues Turnaround", blurb: "I · VI♯9 · ii · V",
        movement: "The last two bars, spinning you back to the top. Every chord is a dominant driving to the next.",
        chords: [c(0, "dom13"), c(9, "dom7#9"), c(2, "min9"), c(7, "dom7b9")] },
      { id: "minorblues", name: "Minor Blues", blurb: "i · iv · i · V♭9",
        movement: "The dark twelve. The V♭9 is the only chord with any pull — everything else just broods.",
        chords: [c(0, "min9"), c(5, "min9"), c(0, "min9"), c(7, "dom7b9")] },
      { id: "quickchange", name: "Quick Change", blurb: "I7 · IV7 · I7 · I7",
        movement: "IV arrives in bar two and leaves immediately. Stops the opening from sitting still.",
        chords: [c(0, "dom9"), c(5, "dom9"), c(0, "dom9"), c(0, "dom13")] },
      { id: "birdblues", name: "Bird Blues", blurb: "I · viiø · III7 · vi — Parker's blues",
        movement: "Parker replaced the static blues with a chain of ii–Vs falling in fifths. A blues that's secretly Giant Steps.",
        chords: [c(0, "maj9"), c(11, "m7b5"), c(4, "dom7b9"), c(9, "min9")] },
      { id: "slowblues", name: "Slow Blues", blurb: "I7 · IV7 · I7 · V7 — the twelve, slow",
        movement: "The bones. Three chords, all dominants, none of them resolving. The vocal does the work.",
        chords: [c(0, "dom9"), c(5, "dom13"), c(0, "dom9"), c(7, "dom13")] },
    ],
  },

  // =========================================================================
  {
    id: "movements",
    name: "Movements",
    tagline: "the devices themselves — learn the moves, not the tunes",
    theory: {
      approach:
        "These aren't songs — they're the individual MOVES that songs are built from. Learn each one as a self-contained gesture, hear what it does, then drop it into your own progressions. Every one of these is a way of getting from A to B that's more interesting than going straight there.",
      voiceLeading:
        "Each device is really a voice-leading trick wearing a chord costume. The tritone sub is 'keep the guide tones, move the bass by a semitone'. The passing diminished is 'the bass wanted to walk chromatically'. Learn the MOTION, not the chord name.",
      targets:
        "In every one of these, find the note that moves by a half-step. That's the hinge the whole device swings on.",
      scales:
        "Follow the chord: altered over altered dominants, diminished over °7, Lydian over the borrowed majors.",
      devices: [
        { name: "Substitution", what: "Replace a chord with one that shares its guide tones." },
        { name: "Interpolation", what: "Insert a chord between two others to fill a chromatic gap." },
        { name: "Borrowing", what: "Steal a chord from the parallel minor or major." },
        { name: "Pedal", what: "Freeze the bass and let the harmony argue with it." },
      ],
    },
    progressions: [
      { id: "m-tritone", name: "Tritone Substitution", blurb: "ii · ♭II7 · I",
        movement: "♭II7 and V7 share the same 3rd and 7th (swapped). So the guide tones stay put — only the bass slides down a semitone into the tonic.",
        chords: [c(2, "min9"), c(1, "dom13"), c(0, "maj9")] },
      { id: "m-backdoor", name: "Backdoor ii–V", blurb: "iv · ♭VII7 · I",
        movement: "The ♭7 of ♭VII7 is the ♭3 of the key — it falls a half-step into the 3rd of I. Resolution from the flat side.",
        chords: [c(5, "min9"), c(10, "dom13"), c(0, "maj9")] },
      { id: "m-passing", name: "Chromatic Passing °7", blurb: "I · ♯I° · ii",
        movement: "The bass wanted to walk C–C♯–D. The °7 is just that middle step, harmonised.",
        chords: [c(0, "maj9"), c(1, "dim7"), c(2, "min9")] },
      { id: "m-interchange", name: "Modal Interchange", blurb: "I · iv · I",
        movement: "The minor iv borrowed from the parallel minor. Its ♭6 falls a half-step to the 5th of I — instant ache.",
        chords: [c(0, "maj9"), c(5, "min9"), c(0, "maj9")] },
      { id: "m-neapolitan", name: "Neapolitan", blurb: "♭II · I",
        movement: "The flat-two resolving down a semitone. Ancient, and still devastating.",
        chords: [c(1, "maj9"), c(0, "maj9")] },
      { id: "m-cycle", name: "Dominant Cycle", blurb: "III7 · VI7 · II7 · V7",
        movement: "Every chord is a dominant, each one the V of the next. Roots fall in fifths and the guide tones fall in semitones the whole way.",
        chords: [c(4, "dom7b9"), c(9, "dom7b9"), c(2, "dom9"), c(7, "dom13")] },
      { id: "m-sus", name: "Sus Resolution", blurb: "Vsus · V7 · I",
        movement: "The 4th delays the 3rd, then drops into it. A resolution INSIDE the dominant, before the real one.",
        chords: [c(7, "dom7sus"), c(7, "dom13"), c(0, "maj9")] },
      { id: "m-pedal", name: "Tonic Pedal", blurb: "IV/I · ♭VII/I · V/I · I",
        movement: "The harmony walks; the bass refuses. Every chord becomes a slash chord and the tension is free.",
        chords: [c(5, "maj9", 0), c(10, "maj9", 0), c(7, "dom13", 0), c(0, "maj9", 0)] },
      { id: "m-secondary", name: "Secondary Dominant", blurb: "I · V/V · V · I",
        movement: "II is made major — now it's the V of V. Borrowing a dominant to strengthen the real one.",
        chords: [c(0, "maj9"), c(2, "dom9"), c(7, "dom13"), c(0, "maj9")] },
      { id: "m-deceptive", name: "Deceptive Cadence", blurb: "ii · V · vi",
        movement: "Everything sets up the I — then it lands on vi instead. Two of the three notes are the same, so it half-resolves and half-lies.",
        chords: [c(2, "min9"), c(7, "dom13"), c(9, "min9"), c(0, "maj9")] },
      { id: "m-chromatic", name: "Chromatic ii–V Approach", blurb: "ii · ♭ii · I — slide the whole thing",
        movement: "Take the ii chord and slide it down a semitone into the target. No function at all — the ear buys it because it moves by a half-step.",
        chords: [c(2, "min9"), c(1, "min9"), c(0, "maj9")] },
      { id: "m-diminished-rise", name: "Ascending Diminished", blurb: "I · ♯I° · ii · ♯ii° · iii",
        movement: "The bass climbs chromatically and a °7 harmonises every gap. The gospel staircase.",
        chords: [c(0, "maj9"), c(1, "dim7"), c(2, "min9"), c(3, "dim7"), c(4, "min9")] },
    ],
  },

  // =========================================================================
  {
    id: "pop",
    name: "Pop",
    tagline: "four chords \u00b7 the ones everybody knows",
    theory: {
      approach:
        "Pop harmony is deliberately plain, and that's a feature, not a failure. Four chords, all diatonic, mostly triads \u2014 because the harmony's job is to get out of the way of the melody and the voice. Jazz asks you to listen to the CHORDS; pop asks you to listen to everything on top of them.",
      voiceLeading:
        "Common tones, and lots of them. I\u2013V\u2013vi\u2013IV works because consecutive chords share two notes out of three, so nothing lurches. Keep the top voice as still as possible and let the bass do the moving \u2014 that's why the same four chords can loop forever without tiring the ear.",
      targets:
        "The root and the 3rd. Pop melodies live on chord tones and land on the root \u2014 the hook IS the resolution.",
      scales:
        "The major scale, and the major/minor pentatonic. Chromaticism is usually a mistake here \u2014 one wrong note stands out a mile because nothing else is going on.",
      devices: [
        { name: "The 4-chord loop", what: "I\u2013V\u2013vi\u2013IV and its rotations. It loops because the last chord leads straight back into the first." },
        { name: "The relative minor", what: "vi is the same three notes as I, moved. Free emotional shift, zero effort." },
        { name: "add9 / sus", what: "Colour without jazz. An add9 keeps the triad intact but makes it shimmer \u2014 no 7th, no sophistication, just glow." },
        { name: "The IV\u2013I (plagal)", what: "The 'amen' ending. Softer than V\u2013I, which is why every anthem reaches for it." },
      ],
    },
    progressions: [
      { id: "four-chords", name: "The Four Chords", blurb: "I \u00b7 V \u00b7 vi \u00b7 IV",
        movement: "Every neighbouring pair shares two of its three notes. Nothing ever lurches \u2014 that's why it can loop forever.",
        chords: [c(0, "maj"), c(7, "maj"), c(9, "min"), c(5, "maj")] },
      { id: "sensitive", name: "Sensitive", blurb: "vi \u00b7 IV \u00b7 I \u00b7 V",
        movement: "The same four chords, started on the vi. Beginning in the relative minor makes an identical loop sound sad.",
        chords: [c(9, "min"), c(5, "maj"), c(0, "maj"), c(7, "maj")] },
      { id: "doowop", name: "50s / Doo-Wop", blurb: "I \u00b7 vi \u00b7 IV \u00b7 V",
        movement: "I to vi holds two common tones \u2014 barely a change at all, just a shadow falling across the same chord.",
        chords: [c(0, "maj"), c(9, "min"), c(5, "maj"), c(7, "maj")] },
      { id: "axis", name: "The Axis", blurb: "I \u00b7 V \u00b7 vi \u00b7 iii \u00b7 IV",
        movement: "The bass falls stepwise while the top voice hangs on the tonic. Five chords, one held note.",
        chords: [c(0, "maj"), c(7, "maj"), c(9, "min"), c(4, "min"), c(5, "maj")] },
      { id: "ballad", name: "Ballad", blurb: "I \u00b7 iii \u00b7 IV \u00b7 V",
        movement: "iii is I with a new bass note. It rises without going anywhere \u2014 perfect for a verse.",
        chords: [c(0, "maj"), c(4, "min"), c(5, "maj"), c(7, "maj")] },
      { id: "anthem", name: "Anthem", blurb: "IV \u00b7 I \u00b7 V \u00b7 vi",
        movement: "Starting on IV means you're already leaning home before the first bar is out. That's the lift.",
        chords: [c(5, "maj"), c(0, "maj"), c(7, "maj"), c(9, "min")] },
      { id: "minor-pop", name: "Minor Pop", blurb: "i \u00b7 \u266dVI \u00b7 \u266dIII \u00b7 \u266dVII",
        movement: "All four chords come from the natural minor. No leading tone anywhere, so it never resolves \u2014 it just circles.",
        chords: [c(0, "min"), c(8, "maj"), c(3, "maj"), c(10, "maj")] },
      { id: "shimmer", name: "Add9 Shimmer", blurb: "Iadd9 \u00b7 Vadd9 \u00b7 vi(add9) \u00b7 IVadd9",
        movement: "The same four chords, but the 9th rings through all of them as a held top voice. One note turns pop into atmosphere.",
        chords: [c(0, "add9"), c(7, "add9"), c(9, "minAdd9"), c(5, "add9")] },
      { id: "sus-pop", name: "Suspended Pop", blurb: "Isus4 \u00b7 I \u00b7 Vsus4 \u00b7 V",
        movement: "The 4th hangs, then drops into the 3rd. A tiny delay, and the resolution feels earned.",
        chords: [c(0, "sus4"), c(0, "maj"), c(7, "sus4"), c(7, "maj")] },
    ],
  },

  // =========================================================================
  {
    id: "house",
    name: "House / Dance",
    tagline: "four-on-the-floor \u00b7 piano stabs \u00b7 cheesy and proud",
    theory: {
      approach:
        "House harmony is a LOOP, not a journey. It never resolves, because resolving would end it \u2014 and the track has six more minutes to go. Four bars, usually minor, usually the same four chords, and all the interest comes from rhythm, filtering, and the moment the piano stabs drop in. Simple chords, played with total conviction.",
      voiceLeading:
        "Barely any. House piano is played in INVERSIONS with a fixed hand shape \u2014 you keep the shape and slide it. The classic sound is the chord voiced high and tight, stabbed off the beat, with the bass an octave below doing the real harmonic work.",
      targets:
        "The root and the 5th. House hooks are simple on purpose; the emotion comes from the chord underneath, not from a clever melody note.",
      scales:
        "Natural minor and minor pentatonic, almost exclusively. Dorian for the deeper, jazzier end of the room.",
      devices: [
        { name: "Piano stabs", what: "Short, hard, off-beat chords. Turn Note Length right down in the Groove \u2014 the silence IS the rhythm." },
        { name: "The Andalusian drop", what: "i\u2013\u266dVII\u2013\u266dVI\u2013V. The bass walks down four steps and lands on the one chord that pulls hard back to the top." },
        { name: "add9 and sus", what: "How to sound lush without sounding jazzy. A 7th is often simply too clever for a club." },
        { name: "The two-chord vamp", what: "Two chords, sixteen bars. When the harmony stops moving, everything else becomes the event." },
      ],
    },
    progressions: [
      { id: "classic-house", name: "Classic House", blurb: "i \u00b7 \u266dVI \u00b7 \u266dIII \u00b7 \u266dVII",
        movement: "Am\u2013F\u2013C\u2013G. Four minor-key chords that loop with no resolution \u2014 it can just keep going, which is the entire point.",
        chords: [c(0, "min"), c(8, "maj"), c(3, "maj"), c(10, "maj")] },
      { id: "andalusian", name: "Andalusian Drop", blurb: "i \u00b7 \u266dVII \u00b7 \u266dVI \u00b7 V",
        movement: "The bass walks straight down: A\u2013G\u2013F\u2013E. That final V is the only chord with any pull, and it slams you back to the top.",
        chords: [c(0, "min"), c(10, "maj"), c(8, "maj"), c(7, "maj")] },
      { id: "deep-house", name: "Deep House", blurb: "im7 \u00b7 iv7 \u00b7 \u266dVII7 \u00b7 \u266dIIImaj7",
        movement: "The same loop, but with 7ths \u2014 the deeper, smokier end of the room. Still never resolves.",
        chords: [c(0, "min7"), c(5, "min7"), c(10, "dom7"), c(3, "maj7")] },
      { id: "piano-house", name: "Cheesy Piano House", blurb: "vi \u00b7 IV \u00b7 I \u00b7 V \u2014 stab it",
        movement: "The 90s piano-house loop. Drop Note Length and push the hits off the beat and it's instantly a warehouse.",
        chords: [c(9, "min"), c(5, "maj"), c(0, "maj"), c(7, "maj")] },
      { id: "organ-bass", name: "Organ Bass", blurb: "i \u00b7 iv \u00b7 \u266dVII \u00b7 \u266dIII",
        movement: "Am\u2013Dm\u2013G\u2013C. Roots falling in fourths \u2014 the most inevitable motion there is, which is why it feels so good under a loop.",
        chords: [c(0, "min"), c(5, "min"), c(10, "maj"), c(3, "maj")] },
      { id: "two-chord", name: "Two-Chord Vamp", blurb: "i \u00b7 \u266dVI \u2014 and that's it",
        movement: "Two chords sharing two notes. When the harmony stops moving, the filter sweep becomes the song.",
        chords: [c(0, "min"), c(8, "maj"), c(0, "min"), c(8, "maj")] },
      { id: "euphoric", name: "Euphoric", blurb: "IVadd9 \u00b7 Vadd9 \u00b7 vi(add9) \u00b7 Iadd9",
        movement: "Rising, with the 9th ringing over the top of everything. The hands-in-the-air loop.",
        chords: [c(5, "add9"), c(7, "add9"), c(9, "minAdd9"), c(0, "add9")] },
      { id: "disco", name: "Disco", blurb: "Imaj7 \u00b7 vi7 \u00b7 ii7 \u00b7 V7",
        movement: "A ii\u2013V\u2013I dressed for the dancefloor. The 7ths are what make it disco rather than pop.",
        chords: [c(0, "maj7"), c(9, "min7"), c(2, "min7"), c(7, "dom7")] },
      { id: "sad-banger", name: "Sad Banger", blurb: "i \u00b7 \u266dIII \u00b7 \u266dVII \u00b7 iv",
        movement: "Minor, but every second chord is major \u2014 that flicker between light and dark is why it makes people cry at 4am.",
        chords: [c(0, "min"), c(3, "maj"), c(10, "maj"), c(5, "min")] },
    ],
  },

  // =========================================================================
  {
    id: "lofi",
    name: "Lo-Fi (mndsgn)",
    tagline: "Stones Throw \u00b7 dusty \u00b7 woozy \u00b7 behind the beat",
    theory: {
      approach:
        "Lo-fi jazz is jazz harmony played like a LOOP and recorded badly on purpose. The chords are lush \u2014 maj9, min11, sus \u2014 but they don't progress, they cycle. The sophistication lives in the voicing and the feel, not in the function. mndsgn, Dilla, Knxwledge: the harmony is a bed, and the point is the pocket.",
      voiceLeading:
        "Barely any \u2014 and deliberately so. PLANE the voicing: keep the same lush shape and slide it to a new root, common tones be damned. Then let the timing fall apart slightly. The dust and the drag aren't decoration; they're load-bearing. A perfectly-timed lo-fi loop is just a boring jazz loop.",
      targets:
        "The 9th and the 6th. Avoid the leading tone \u2014 it wants to resolve, and resolution is the enemy of a loop that has to run for four minutes.",
      scales:
        "Dorian and Lydian, plus the pentatonics. Keep the melody SIMPLE over lush chords \u2014 the chord is already doing the emotional work.",
      devices: [
        { name: "Planing lush voicings", what: "Slide a maj9 shape up a minor 3rd. Don't voice-lead, just move the hand. Instantly woozy." },
        { name: "The never-resolving ii\u2013V", what: "Loop a ii\u2013V and simply never play the I. The tension becomes the vibe instead of a problem to solve." },
        { name: "Drunk swing", what: "Heavy laid-back plus heavy humanize. Play behind the beat until it's almost wrong \u2014 then stop." },
        { name: "Upper structures", what: "Stack a triad on top for instant colour without rethinking the voicing. The lazy way to sound rich, which is very much the point." },
      ],
    },
    progressions: [
      { id: "rare-pleasure", name: "Rare Pleasure", blurb: "Imaj9 \u00b7 \u266dIIImaj9 \u2014 planed up a minor 3rd",
        movement: "The identical shape, slid up three frets. No voice leading at all \u2014 that lurch IS the sound.",
        chords: [c(0, "maj9"), c(3, "maj9"), c(0, "maj9"), c(3, "maj9")] },
      { id: "sleep-loop", name: "Sleep Loop", blurb: "i11 \u00b7 IVmaj9",
        movement: "Two chords sharing three notes. Nothing happens, forever, and that's the request.",
        chords: [c(0, "min11"), c(5, "maj9"), c(0, "min11"), c(5, "maj9")] },
      { id: "woozy", name: "Woozy", blurb: "Imaj7\u266f11 \u00b7 \u266dVIImaj9",
        movement: "The \u266f11 never settles and the \u266dVII never resolves. Two chords, both refusing to land.",
        chords: [c(0, "maj7#11"), c(10, "maj9"), c(0, "maj7#11"), c(10, "maj9")] },
      { id: "tape-warp", name: "Tape Warp", blurb: "Imaj9 \u00b7 \u266dIImaj9 \u00b7 Imaj9",
        movement: "A whole voicing dragged up a semitone and back. Sounds like the tape slipped \u2014 keep it.",
        chords: [c(0, "maj9"), c(1, "maj9"), c(0, "maj9"), c(0, "6/9")] },
      { id: "dusty-25", name: "Dusty 2-5 (no resolution)", blurb: "ii11 \u00b7 V13 \u2014 and never the I",
        movement: "The most-resolved gesture in jazz, looped and never allowed to resolve. The itch is the point.",
        chords: [c(2, "min11"), c(7, "dom13"), c(2, "min11"), c(7, "dom13")] },
      { id: "body-wash", name: "Body Wash", blurb: "i9 \u00b7 \u266dVImaj9 \u00b7 \u266dVIImaj9",
        movement: "Straight out of the natural minor, all ninths. It rises but never arrives.",
        chords: [c(0, "min9"), c(8, "maj9"), c(10, "maj9"), c(0, "min9")] },
      { id: "sunset", name: "Sunset", blurb: "vi9 \u00b7 IVmaj9 \u00b7 Imaj9 \u00b7 V13",
        movement: "The pop loop, but every chord is lush. Same bones, completely different room.",
        chords: [c(9, "min9"), c(5, "maj9"), c(0, "maj9"), c(7, "dom13")] },
      { id: "stacked", name: "Stacked", blurb: "Upper structures over a lazy loop",
        movement: "A D triad over the Cmaj9 and an E\u266d triad over the F \u2014 three tensions each, added without a single extra thought.",
        chords: [
          { offset: 0, quality: "maj9", upper: 2 },   // D over Cmaj9  -> 9 ♯11 13
          { offset: 5, quality: "maj9", upper: 7 },   // G over Fmaj9  -> 9 ♯11 13
          { offset: 9, quality: "min11", upper: 2 },  // D over Am11   -> 11 13 root
          { offset: 7, quality: "dom13", upper: 9 },  // A over G13    -> 9 ♯11 13
        ] },
    ],
  },
];
// ---------------------------------------------------------------------------
// Keys & note spelling
// ---------------------------------------------------------------------------
const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES  = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SHARP_KEYS = new Set([0, 7, 2, 9, 4, 11, 6]); // C G D A E B F♯

export type Key = { pc: number; name: string };
export const KEYS: Key[] = Array.from({ length: 12 }, (_, pc) => ({
  pc,
  name: (SHARP_KEYS.has(pc) ? SHARP_NAMES : FLAT_NAMES)[pc],
}));

// Spelling is degree-aware, not just key-aware: the flat degrees (♭II ♭III ♭VI
// ♭VII) always read flat and ♯IV always reads sharp, whatever the key — so C's
// ♭VII is B♭, never A♯. Diatonic degrees follow the key's own accidental.
const FLAT_DEGREES = new Set([1, 3, 8, 10]);

export function noteNameFor(pc: number, tonicPc: number): string {
  const degree = mod12(pc - tonicPc);
  const useSharps =
    degree === 6 ? true : FLAT_DEGREES.has(degree) ? false : SHARP_KEYS.has(tonicPc);
  return (useSharps ? SHARP_NAMES : FLAT_NAMES)[mod12(pc)];
}

const ROMAN_BASE = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"];

export function romanFor(wc: WorkingChord, tonicPc: number): string {
  const q = QUALITIES[wc.quality];
  let num = ROMAN_BASE[mod12(wc.rootPc - tonicPc)];
  if (q.minor) num = num.toLowerCase();
  let r = num + q.romanSuffix;
  if (wc.bass !== null && wc.bass !== wc.rootPc) r += `/${noteNameFor(wc.bass, tonicPc)}`;
  return r;
}

// ---------------------------------------------------------------------------
// Building the chord
// ---------------------------------------------------------------------------
export type NoteRole = "root" | "tone" | "bass" | "scale" | "upper";
export type Note = {
  midi: number;
  pc: number;
  name: string;
  role: NoteRole;
  /** scale degree label ("♭7", "♯11"), shown in the scale view */
  degree?: string;
};

export type BuiltChord = {
  rootPc: number;
  quality: QualityId;
  variant: number;
  variantName: string;
  variantCount: number;
  inversion: number;
  bass: number | null;
  shape: number;
  upper: number | null;
  /** what the upper structure adds, e.g. ["9", "♯11", "13"] */
  upperTensions: string[];
  upperName: string | null;
  roman: string;
  symbol: string;   // e.g. "E♭maj9/G"
  rootName: string;
  notes: Note[];
  scale: number | null;
  scaleOptions: Scale[];
  /** pitch-classes of the selected scale, or null if none shown */
  scalePcs: number[] | null;
  scaleName: string | null;
};

const TONIC_BASE_MIDI = 48; // C3
const BASS_BASE_MIDI = 36;  // C2 — slash basses live down here, always under the voicing

/**
 * Where the tonic sits.
 *
 * Naively this was `48 + tonicPc`, which put a progression in B nearly an
 * octave above the same progression in C — different character, and tall
 * voicings in high keys drifted off the top of the keyboard. Wrap the upper
 * half of the circle downward so every key lands in a comparable register.
 */
const tonicMidi = (tonicPc: number) => TONIC_BASE_MIDI + (tonicPc > 6 ? tonicPc - 12 : tonicPc);
const UPPER_BASE_MIDI = 72; // C5 — upper structures sit ABOVE the voicing, always

/** what an interval above the chord root is CALLED once you're past the octave */
const TENSION: Record<number, string> = {
  0: "root", 1: "♭9", 2: "9", 3: "♯9", 4: "3", 5: "11", 6: "♯11",
  7: "5", 8: "♭13", 9: "13", 10: "♭7", 11: "7",
};

/** Over a MINOR chord that interval isn't a ♯9 — it's the chord's own ♭3. */
const tensionName = (interval: number, minor: boolean) =>
  minor && mod12(interval) === 3 ? "♭3" : TENSION[mod12(interval)];

/** Rotate the lowest note up an octave, `times` times. */
function invert(voicing: number[], times: number): number[] {
  const v = [...voicing].sort((a, b) => a - b);
  for (let i = 0; i < times; i++) {
    const lowest = v.shift();
    if (lowest === undefined) break;
    v.push(lowest + 12);
    v.sort((a, b) => a - b);
  }
  return v;
}

export function buildChord(wc: WorkingChord, tonicPc: number): BuiltChord {
  const q = QUALITIES[wc.quality];
  const variant = Math.min(Math.max(wc.variant, 0), q.variants.length - 1);
  const base = q.variants[variant].voicing;
  const inversion = mod12(wc.inversion) % base.length;
  const voicing = invert(base, inversion);

  // root sits within the octave above the tonic, so voicings stay in a comfy range
  const rootMidi = tonicMidi(tonicPc) + mod12(wc.rootPc - tonicPc);

  const notes: Note[] = voicing.map((iv) => {
    const midi = rootMidi + iv;
    const pc = mod12(midi);
    return {
      midi,
      pc,
      name: noteNameFor(pc, tonicPc),
      role: pc === mod12(wc.rootPc) ? ("root" as NoteRole) : ("tone" as NoteRole),
    };
  });

  // UPPER STRUCTURE — a major triad stacked above everything. Each of its three
  // notes becomes a tension on the underlying chord; that's the whole trick.
  const upperTensions: string[] = [];
  let upperName: string | null = null;

  if (wc.upper !== null) {
    upperName = noteNameFor(wc.upper, tonicPc);

    // It has to sit ABOVE the voicing — and a min11 or a 13 chord already
    // reaches high, so a fixed register would land the "upper" triad inside
    // the chord. Anchor it to the actual top note instead.
    const top = notes.length ? Math.max(...notes.map((n) => n.midi)) : TONIC_BASE_MIDI;
    const floor = Math.max(top + 1, UPPER_BASE_MIDI);
    const triadRoot = floor + mod12(wc.upper - floor);

    [0, 4, 7].forEach((iv) => {
      const midi = triadRoot + iv;
      const pc = mod12(midi);
      const label = tensionName(pc - wc.rootPc, q.minor);
      notes.push({ midi, pc, name: noteNameFor(pc, tonicPc), role: "upper", degree: label });
      upperTensions.push(label);
    });
  }

  // slash bass, in its own register below everything
  if (wc.bass !== null) {
    const bassMidi = BASS_BASE_MIDI + (tonicPc > 6 ? tonicPc - 12 : tonicPc) + mod12(wc.bass - tonicPc);
    notes.unshift({
      midi: bassMidi,
      pc: mod12(bassMidi),
      name: noteNameFor(bassMidi, tonicPc),
      role: "bass",
    });
  }

  const rootName = noteNameFor(mod12(wc.rootPc), tonicPc);
  const slash =
    wc.bass !== null && wc.bass !== wc.rootPc ? `/${noteNameFor(wc.bass, tonicPc)}` : "";
  // polychord notation: the upper triad goes on TOP of the symbol
  const upperPrefix = upperName ? `${upperName}/` : "";

  const scaleOptions = SCALES_FOR[wc.quality];
  const sel = wc.scale !== null && wc.scale < scaleOptions.length ? scaleOptions[wc.scale] : null;

  return {
    rootPc: wc.rootPc,
    quality: wc.quality,
    variant,
    variantName: q.variants[variant].name,
    variantCount: q.variants.length,
    inversion,
    bass: wc.bass,
    shape: wc.shape,
    upper: wc.upper,
    upperTensions,
    upperName,
    roman: romanFor(wc, tonicPc),
    symbol: `${upperPrefix}${rootName}${q.symbol}${slash}`,
    rootName,
    notes,
    scale: wc.scale,
    scaleOptions,
    scalePcs: sel ? sel.intervals.map((i) => mod12(wc.rootPc + i)) : null,
    scaleName: sel ? sel.name : null,
  };
}

/** What stacking a major triad on `upperPc` would add to a chord rooted at `rootPc`. */
export function upperTensionsFor(rootPc: number, upperPc: number, quality: QualityId): string[] {
  const minor = QUALITIES[quality].minor;
  return [0, 4, 7].map((iv) => tensionName(upperPc + iv - rootPc, minor));
}

export function templateToWorking(prog: Progression, tonicPc: number): WorkingChord[] {
  return prog.chords.map((s) => ({
    rootPc: mod12(tonicPc + s.offset),
    quality: s.quality,
    variant: s.variant ?? 0,
    inversion: 0,
    bass: s.bass === undefined ? null : mod12(tonicPc + s.bass),
    scale: null,
    shape: 0,
    upper: s.upper === undefined ? null : mod12(tonicPc + s.upper),
  }));
}

export function buildProgression(chords: WorkingChord[], tonicPc: number): BuiltChord[] {
  return chords.map((wc) => buildChord(wc, tonicPc));
}

/** Every scale option across the progression, deduped — "what can I play over this?" */
export function scaleDigest(chords: BuiltChord[], tonicPc: number) {
  return chords.map((ch) => ({
    symbol: ch.symbol,
    roman: ch.roman,
    options: ch.scaleOptions.map((s) => ({
      name: s.name,
      note: s.note,
      notes: s.intervals.map((i) => noteNameFor(ch.rootPc + i, tonicPc)),
    })),
  }));
}

// ---------------------------------------------------------------------------
// Scale laid out on the keyboard — two octaves from the chord's root, with the
// chord's own tones marked so you can see the shape living inside the scale.
// ---------------------------------------------------------------------------
export type ScaleView = {
  notes: Note[];
  range: KeyRange;
  scale: Scale;
  /** the chord's tones, spelled — "these are the ones that are already home" */
  chordToneNames: string[];
};

export function buildScaleView(chord: BuiltChord, scaleIndex: number, tonicPc: number): ScaleView {
  const scale = chord.scaleOptions[scaleIndex];
  const rootMidi = tonicMidi(tonicPc) + mod12(chord.rootPc - tonicPc);

  // pitch-classes actually in the voicing (ignore the slash bass)
  const chordPcs = new Set(chord.notes.filter((n) => n.role !== "bass").map((n) => n.pc));

  const notes: Note[] = [];
  for (let midi = rootMidi; midi <= rootMidi + 24; midi++) {
    const iv = mod12(midi - chord.rootPc);
    const idx = scale.intervals.indexOf(iv);
    if (idx === -1) continue; // not in the scale
    const pc = mod12(midi);
    const isRoot = pc === mod12(chord.rootPc);
    notes.push({
      midi,
      pc,
      name: noteNameFor(pc, tonicPc),
      degree: scale.degrees[idx],
      role: isRoot ? "root" : chordPcs.has(pc) ? "tone" : "scale",
    });
  }

  return {
    notes,
    range: {
      low: Math.floor((rootMidi - 1) / 12) * 12,
      high: Math.ceil((rootMidi + 25) / 12) * 12,
    },
    scale,
    chordToneNames: chord.notes
      .filter((n) => n.role !== "bass")
      .map((n) => n.name),
  };
}

// ---------------------------------------------------------------------------
// Keyboard range — shared across every chord so shapes are comparable
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
  return {
    low: Math.floor((min - 1) / 12) * 12,
    high: Math.ceil((max + 1) / 12) * 12,
  };
}

const WHITE_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
export const isWhite = (midi: number) => WHITE_PCS.has(mod12(midi));
