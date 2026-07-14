"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChordCard, { type Instrument } from "./ChordCard";
import ScaleModal from "./ScaleModal";
import PlayModal from "./PlayModal";
import SoloModal from "./SoloModal";
import SoloWorkshop from "./SoloWorkshop";
import TheoryModal from "./TheoryModal";
import FamilyModal from "./FamilyModal";
import GrooveModal from "./GrooveModal";
import MelodyModal from "./MelodyModal";
import { DEFAULT_MELODY, type MelodyOpts } from "@/lib/melody";
import SuggestPanel from "./SuggestPanel";
import { extendProgression, type PrincipleId } from "@/lib/suggest";
import { TONES, playChord, playGroove, setTone, type ProgressionHandle, type ToneId } from "@/lib/audio";
import { findShapes } from "@/lib/guitar";
import { grooveToMidi, downloadMidi } from "@/lib/midi";
import { FEELS, PATTERNS, buildGroove, defaultGroove, fitPatterns, grooveBeats, type Groove } from "@/lib/groove";
import { guideMotion, motionBetween, smoothVoicings } from "@/lib/voiceleading";
import { applyUppers, clearUppers } from "@/lib/upper";
import {
  KEYS,
  STYLES,
  buildChord,
  buildProgression,
  defaultChord,
  noteNameFor,
  rangeForChords,
  templateToWorking,
  type BuiltChord,
  type WorkingChord,
} from "@/lib/music";

const mod12 = (n: number) => ((n % 12) + 12) % 12;

export default function Board() {
  const [tonicPc, setTonicPc] = useState(0);
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [chords, setChords] = useState<WorkingChord[]>(() =>
    templateToWorking(STYLES[0].progressions[0], 0),
  );
  const [loadedId, setLoadedId] = useState<string | null>(STYLES[0].progressions[0].id);
  const [bpm, setBpm] = useState(72);
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showScales, setShowScales] = useState(false);
  const [scaleFor, setScaleFor] = useState<number | null>(null); // chord index in the scale modal
  const [perfOpen, setPerfOpen] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>("piano");
  const [soloFor, setSoloFor] = useState<number | null>(null);
  const [lineOpen, setLineOpen] = useState(false);
  const [theoryOpen, setTheoryOpen] = useState(false);
  const [grooveOpen, setGrooveOpen] = useState(false);
  const [melodyOpen, setMelodyOpen] = useState(false);
  const [melodyOpts, setMelodyOpts] = useState<MelodyOpts>(DEFAULT_MELODY);
  const [luck, setLuck] = useState(1);
  const [audition, setAudition] = useState(true);
  const [toneId, setToneId] = useState<ToneId>("rhodes");
  const [uppersOn, setUppersOn] = useState(false);
  const [familyFor, setFamilyFor] = useState<number | null>(null);
  const [groove, setGroove] = useState<Groove>(() => defaultGroove(4));
  const handleRef = useRef<ProgressionHandle | null>(null);

  const style = useMemo(() => STYLES.find((s) => s.id === styleId)!, [styleId]);
  const loadedProg = useMemo(
    () => (loadedId ? style.progressions.find((p) => p.id === loadedId) ?? null : null),
    [style, loadedId],
  );
  const built = useMemo(() => buildProgression(chords, tonicPc), [chords, tonicPc]);
  const range = useMemo(() => rangeForChords(built), [built]);

  // guitar grips for every chord, and what each chord actually sounds on the
  // selected instrument (a guitar plays a 4-note grip, not the piano's stack)
  const shapes = useMemo(() => built.map((ch) => findShapes(ch, tonicPc)), [built, tonicPc]);
  const voices = useMemo(
    () =>
      built.map((ch, i) => {
        if (instrument === "guitar" && shapes[i].length) {
          return shapes[i][ch.shape % shapes[i].length].midis;
        }
        return ch.notes.map((n) => n.midi);
      }),
    [built, shapes, instrument],
  );

  // the groove turns the chord list into an actual performance — and it's the
  // SAME events the MIDI export writes, so what you hear is what you get
  const grooved = useMemo(
    () => buildGroove(voices, fitPatterns(groove, voices.length)),
    [voices, groove],
  );

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setCurrent(null);
    setPlaying(false);
  };
  useEffect(() => () => { handleRef.current?.stop(); }, []);

  // ---- mutations ----
  const changeKey = (pc: number) => {
    stop();
    const d = pc - tonicPc;
    setChords((cs) => cs.map((c) => ({
      ...c,
      rootPc: mod12(c.rootPc + d),
      bass: c.bass === null ? null : mod12(c.bass + d),
      // the upper structure has to travel with the chord too, or a key change
      // silently turns every polychord into a different one
      upper: c.upper === null ? null : mod12(c.upper + d),
    })));
    setTonicPc(pc);
  };
  const loadTemplate = (id: string) => {
    stop();
    const p = style.progressions.find((x) => x.id === id);
    if (!p) return;
    const next = templateToWorking(p, tonicPc);
    setChords(uppersOn ? applyUppers(next, buildProgression(next, tonicPc)) : next);
    setLoadedId(p.id);
  };
  const edit = (fn: (cs: WorkingChord[]) => WorkingChord[]) => {
    stop();
    setLoadedId(null);
    setChords(fn);
  };
  /** what a single chord sounds like right now, on the instrument you're using */
  const voiceOf = (wc: WorkingChord): number[] => {
    const b = buildChord(wc, tonicPc);
    if (instrument === "guitar") {
      const sh = findShapes(b, tonicPc);
      if (sh.length) return sh[wc.shape % sh.length].midis;
    }
    return b.notes.map((n) => n.midi);
  };

  /** Hear it the moment you place it — that's what auditioning a chord means. */
  const hear = (wc: WorkingChord) => {
    if (audition) playChord(voiceOf(wc), { roll: true });
  };

  // only these actually change the SOUND — re-playing on a scale-overlay change
  // would just be noise
  const SOUNDING = ["rootPc", "quality", "variant", "inversion", "bass", "upper", "shape"];

  const addChord = () => {
    const wc = defaultChord(tonicPc);
    edit((cs) => [...cs, wc]);
    hear(wc);
  };
  const removeChord = (i: number) => edit((cs) => cs.filter((_, k) => k !== i));
  const updateChord = (i: number, patch: Partial<WorkingChord>) => {
    edit((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
    if (Object.keys(patch).some((k) => SOUNDING.includes(k))) {
      hear({ ...chords[i], ...patch });
    }
  };
  const moveChord = (i: number, dir: -1 | 1) =>
    edit((cs) => {
      const j = i + dir;
      if (j < 0 || j >= cs.length) return cs;
      const n = [...cs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const clearAll = () => edit(() => []);
  const smooth = () => edit((cs) => smoothVoicings(cs, tonicPc));

  /**
   * Stack an upper-structure triad on every chord at once — chosen so the
   * triads voice-lead through the progression rather than lurching. Each one is
   * still editable by hand afterwards.
   */
  const toggleUppers = () => {
    stop();
    const next = !uppersOn;
    setUppersOn(next);
    setChords((cs) =>
      next ? applyUppers(cs, buildProgression(cs, tonicPc)) : clearUppers(cs),
    );
  };
  const addSuggested = (wc: WorkingChord) => { edit((cs) => [...cs, wc]); hear(wc); };

  /** Drop an approach (its ii–V, a passing diminished…) in front of a chord. */
  const insertBefore = (i: number, wcs: WorkingChord[]) => {
    edit((cs) => [...cs.slice(0, i), ...wcs, ...cs.slice(i)]);
    if (wcs.length) hear(wcs[0]);
  };
  const extend = (howMany: number, seed: number, principle: PrincipleId | "all") =>
    edit((cs) => extendProgression(cs, tonicPc, styleId, howMany, seed, principle));

  /**
   * Feeling lucky — roll a whole idea at once: key, style, progression, groove
   * and melody. Seeded, so it's a fresh idea each press rather than noise.
   */
  const feelingLucky = () => {
    stop();
    const seed = luck;
    setLuck((n) => n + 1);
    let a = (seed * 2654435761) >>> 0;
    const rand = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

    const st = pick(STYLES);
    const prog = pick(st.progressions);
    const pc = Math.floor(rand() * 12);
    const next = templateToWorking(prog, pc);

    setStyleId(st.id);
    setLoadedId(prog.id);
    setTonicPc(pc);
    setChords(next);
    setBpm(
      st.id === "house" ? 118 + Math.floor(rand() * 10)
        : st.id === "lofi" ? 68 + Math.floor(rand() * 14)
          : 70 + Math.floor(rand() * 40),
    );

    // a feel that suits the genre, and a rhythm per chord
    const feel =
      st.id === "lofi" ? FEELS.find((f) => f.id === "lofi")!
        : st.id === "house" || st.id === "pop"
          ? pick(FEELS.filter((f) => f.id === "straight" || f.id === "stabs"))
          : pick(FEELS.filter((f) => f.id !== "lofi"));
    setGroove({
      swing: feel.swing,
      length: feel.length,
      humanize: feel.humanize,
      laidBack: feel.laidBack,
      patterns: next.map(() => [...pick(PATTERNS).steps]),
    });

    setMelodyOpts((o) => ({ ...o, seed: o.seed + 1 + Math.floor(rand() * 50) }));
  };

  const toggleAllScales = () => {
    const next = !showScales;
    setShowScales(next);
    setChords((cs) => cs.map((c) => ({ ...c, scale: next ? 0 : null })));
  };

  const play = () => {
    if (handleRef.current) return stop();
    if (!built.length) return;
    handleRef.current = playGroove(
      grooved, bpm, grooveBeats(built.length),
      (ci) => setCurrent(ci),
      () => stop(),
    );
    setPlaying(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-24 sm:px-6">
      {/* ---------------- control bar ---------------- */}
      <div className="sticky top-0 z-20 -mx-4 mb-8 border-b border-[var(--line)] bg-[var(--bg)]/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        {/* instrument */}
        <div className="mb-4 flex items-center gap-3">
          <Label inline>Instrument</Label>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-[var(--line-bright)]">
            {(["piano", "guitar"] as Instrument[]).map((ins) => (
              <button
                key={ins}
                type="button"
                onClick={() => { stop(); setInstrument(ins); }}
                className={[
                  "px-4 py-1.5 text-sm font-semibold capitalize transition",
                  instrument === ins
                    ? "bg-[var(--ink)] text-black"
                    : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {ins === "piano" ? "🎹 Piano" : "🎸 Guitar"}
              </button>
            ))}
          </div>

          <Label inline>Sound</Label>
          <select
            value={toneId}
            onChange={(e) => {
              stop();
              const t = e.target.value as ToneId;
              setToneId(t);
              setTone(t); // the synth reads this for every note from here on
              if (built.length) playChord(voices[0], { roll: true });
            }}
            title={TONES.find((t) => t.id === toneId)?.why}
            className="appearance-none rounded-lg bg-white/[0.03] px-2.5 py-1.5 font-mono text-sm text-[var(--ink)] ring-1 ring-[var(--line-bright)] focus:outline-none focus:ring-2 focus:ring-[var(--amber)]"
            aria-label="Instrument sound"
          >
            {TONES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAudition((a) => !a)}
            title="Hear each chord as you add or change it"
            className={[
              "rounded-lg px-3 py-1.5 font-mono text-xs transition ring-1",
              audition
                ? "bg-[var(--amber)]/15 text-[var(--amber)] ring-[var(--amber)]/40"
                : "text-[var(--muted)] ring-[var(--line-bright)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            {audition ? "🔊 Audition on" : "🔇 Audition off"}
          </button>
        </div>

        <Label>Key · transposes everything</Label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {KEYS.map((k) => (
            <button
              key={k.pc} type="button" onClick={() => changeKey(k.pc)}
              className={[
                "min-w-9 rounded-lg px-2.5 py-1.5 font-mono text-sm transition",
                k.pc === tonicPc
                  ? "bg-[var(--coral)] text-black shadow-[0_6px_20px_-8px_var(--coral)]"
                  : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {k.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button" onClick={feelingLucky}
            title="Roll a whole idea: key, style, progression, groove and melody"
            className="rounded-lg bg-gradient-to-r from-[var(--coral)] to-[var(--amber)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            🍀 Feeling lucky
          </button>
          <button
            type="button" onClick={play} disabled={!built.length}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-30",
              playing ? "bg-[var(--coral)] text-black" : "bg-[var(--ink)] text-black hover:opacity-90",
            ].join(" ")}
          >
            {playing ? "■ Stop" : "▶ Play progression"}
          </button>
          <button
            type="button" onClick={() => { stop(); setPerfOpen(true); }} disabled={!built.length}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10 disabled:opacity-30"
          >
            ⤢ View progression
          </button>
          <button
            type="button" onClick={addChord}
            className="rounded-lg bg-[var(--amber)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            ＋ Add chord
          </button>
          <button
            type="button"
            onClick={() =>
              downloadMidi(
                grooveToMidi(grooved, bpm, loadedProg?.name ?? "progression"),
                `${(loadedProg?.name ?? "progression").replace(/\s+/g, "-").toLowerCase()}-${KEYS[tonicPc].name}`,
              )
            }
            disabled={!built.length}
            title="Download as a MIDI file — drop it straight into a DAW"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10 disabled:opacity-30"
          >
            ⬇ MIDI
          </button>
          <button
            type="button" onClick={() => { stop(); setGrooveOpen(true); }} disabled={!built.length}
            className="rounded-lg bg-[var(--coral)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-30"
          >
            ♫ Groove
          </button>
          <button
            type="button" onClick={() => { stop(); setMelodyOpen(true); }} disabled={!built.length}
            className="rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-30"
          >
            ♪ Melody
          </button>
          <button
            type="button" onClick={toggleUppers} disabled={!built.length}
            title="Stack a triad on every chord, chosen to voice-lead through the progression"
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition ring-1 disabled:opacity-30",
              uppersOn
                ? "bg-[var(--teal)] text-black ring-transparent"
                : "text-[var(--teal)] ring-[var(--teal)]/40 hover:bg-[var(--teal)]/15",
            ].join(" ")}
          >
            ◆ Upper structures {uppersOn ? "on" : "off"}
          </button>
          <button
            type="button" onClick={smooth} disabled={chords.length < 2}
            title="Re-pick every inversion so the voices move as little as possible"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10 disabled:opacity-30"
          >
            ↝ Smooth voicings
          </button>
          <button
            type="button" onClick={() => { stop(); setLineOpen(true); }} disabled={chords.length < 2}
            className="rounded-lg bg-[var(--violet)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-30"
          >
            ♪ Solo workshop
          </button>
          <button
            type="button" onClick={toggleAllScales}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition ring-1",
              showScales
                ? "bg-[var(--violet)] text-black ring-transparent"
                : "text-[var(--muted)] ring-[var(--line-bright)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            ♦ Scales {showScales ? "on" : "off"}
          </button>
          <div className="flex items-center gap-2">
            <Label inline>Tempo</Label>
            <input
              type="range" min={50} max={110} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="accent-[var(--amber)]" aria-label="Tempo in BPM"
            />
            <span className="w-14 font-mono text-xs tabular-nums text-[var(--muted)]">{bpm} bpm</span>
          </div>
        </div>

        {/* templates */}
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Label inline>Start from</Label>
            {STYLES.map((s) => (
              <button
                key={s.id} type="button" onClick={() => setStyleId(s.id)} title={s.tagline}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  s.id === styleId
                    ? "bg-[var(--amber)] font-semibold text-black"
                    : "bg-white/5 text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {style.progressions.map((p) => (
              <button
                key={p.id} type="button" onClick={() => loadTemplate(p.id)} title={p.blurb}
                className={[
                  "rounded-lg px-3 py-1.5 text-left text-sm transition",
                  p.id === loadedId
                    ? "bg-white/12 text-[var(--ink)] ring-1 ring-[var(--line-bright)]"
                    : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => { stop(); setTheoryOpen(true); }}
              className="rounded-lg bg-[var(--ink)]/10 px-3 py-1.5 font-mono text-xs text-[var(--ink)] ring-1 ring-[var(--line-bright)] transition hover:bg-white/10"
            >
              📖 The {style.name} approach — theory &amp; voice leading
            </button>
            <span className="font-mono text-[11px] text-[var(--muted)]">
              {style.tagline} · {style.progressions.length} progressions
            </span>
          </div>
        </div>
      </div>

      {/* ---------------- heading ---------------- */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {KEYS[tonicPc].name} · {chords.length} chord{chords.length === 1 ? "" : "s"}
          </div>
          <h2 className="font-serif text-3xl text-[var(--ink)] sm:text-4xl">
            {loadedProg ? loadedProg.name : "Your progression"}
          </h2>
          {loadedProg && (
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--muted)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--coral)]">
                movement ·{" "}
              </span>
              {loadedProg.movement}
            </p>
          )}
        </div>
        {chords.length > 0 && (
          <button
            type="button" onClick={clearAll}
            className="rounded-lg px-3 py-1.5 font-mono text-xs text-[var(--muted)] transition hover:bg-white/5 hover:text-[var(--coral)]"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ---------------- the board: one full-width row per chord ---------------- */}
      <div className="flex flex-col gap-4">
        {built.map((ch, i) => (
          <div key={i} className="flex flex-col gap-4">
            <ChordCard
              chord={ch} range={range} index={i} total={built.length} tonicPc={tonicPc}
              instrument={instrument} shapes={shapes[i]} voice={voices[i]}
              playing={current === i}
              someoneElsePlaying={current !== null && current !== i}
              onChange={(patch) => updateChord(i, patch)}
              onRemove={() => removeChord(i)}
              onMove={(dir) => moveChord(i, dir)}
              onOpenScales={() => { stop(); setScaleFor(i); }}
              onOpenSolo={() => { stop(); setSoloFor(i); }}
              onOpenFamily={() => { stop(); setFamilyFor(i); }}
            />
            {i < built.length - 1 && (
              <VoiceLeading a={built[i]} b={built[i + 1]} tonicPc={tonicPc} />
            )}
          </div>
        ))}

        <SuggestPanel
          chords={chords}
          tonicPc={tonicPc}
          styleId={styleId}
          onAdd={addSuggested}
          onExtend={extend}
        />

        <button
          type="button" onClick={addChord}
          className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--line-bright)] py-5 text-[var(--muted)] transition hover:border-[var(--amber)] hover:text-[var(--amber)]"
        >
          <span className="text-xl leading-none">＋</span>
          <span className="font-mono text-xs uppercase tracking-[0.2em]">Or add a blank chord to edit</span>
        </button>
      </div>

      {/* ---------------- scales that work ---------------- */}
      {built.length > 0 && (
        <section className="mt-14">
          <h3 className="font-serif text-2xl text-[var(--ink)]">Scales that work over this</h3>
          <p className="mt-1 mb-5 max-w-prose text-sm text-[var(--muted)]">
            Every chord with the scales you can improvise over it. Pick one on a chord above to
            light it up on the keys — chord tones stay bright, scale tones show as dots.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {built.map((ch, i) => (
              <div key={i} className="rounded-xl border border-[var(--line)] p-4" style={{ background: "var(--panel)" }}>
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="font-serif text-xl text-[var(--ink)]">{ch.symbol}</span>
                  <span className="font-mono text-[11px] text-[var(--amber)]">{ch.roman}</span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {ch.scaleOptions.map((s, si) => (
                    <li key={si}>
                      <button
                        type="button"
                        onClick={() => updateChord(i, { scale: ch.scale === si ? null : si })}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "font-mono text-[13px] transition",
                              ch.scale === si ? "text-[var(--violet)]" : "text-[var(--ink)] hover:text-[var(--violet)]",
                            ].join(" ")}
                          >
                            {s.name}
                          </span>
                          {ch.scale === si && (
                            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--violet)]">shown</span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.intervals.map((iv, k) => (
                            <span
                              key={k}
                              className="rounded bg-white/5 px-1 py-0.5 font-mono text-[10px] text-[var(--muted)]"
                            >
                              {noteNameFor(ch.rootPc + iv, tonicPc)}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{s.note}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 font-mono text-xs text-[var(--muted)]">
        Tap a chord to hear it ·{" "}
        <span className="text-[var(--coral)]">coral = root</span> ·{" "}
        <span className="text-[var(--amber)]">amber = chord tones</span> ·{" "}
        <span className="text-[var(--violet)]">violet = slash bass</span> ·{" "}
        <span className="text-[var(--teal)]">teal = upper structure</span> · dots = scale tones
      </p>

      <ScaleModal
        key={`scale-${scaleFor ?? "none"}`}
        open={scaleFor !== null}
        onClose={() => setScaleFor(null)}
        chord={scaleFor !== null ? built[scaleFor] ?? null : null}
        tonicPc={tonicPc}
        instrument={instrument}
        onPick={(scale) => {
          if (scaleFor !== null) updateChord(scaleFor, { scale });
        }}
      />

      <PlayModal
        open={perfOpen}
        onClose={() => setPerfOpen(false)}
        chords={built}
        range={range}
        tonicPc={tonicPc}
        bpm={bpm}
        instrument={instrument}
        shapes={shapes}
        voices={voices}
      />

      <SoloModal
        key={`solo-${soloFor ?? "none"}`}
        open={soloFor !== null}
        onClose={() => setSoloFor(null)}
        chord={soloFor !== null ? built[soloFor] ?? null : null}
        nextChord={soloFor !== null ? built[soloFor + 1] ?? null : null}
        tonicPc={tonicPc}
        instrument={instrument}
      />

      <SoloWorkshop
        open={lineOpen}
        onClose={() => setLineOpen(false)}
        chords={built}
        voices={voices}
        tonicPc={tonicPc}
        bpm={bpm}
        instrument={instrument}
        onCycleKey={() => changeKey(mod12(tonicPc + 5))}
      />

      <TheoryModal open={theoryOpen} onClose={() => setTheoryOpen(false)} style={style} />

      <FamilyModal
        key={`family-${familyFor ?? "none"}`}
        open={familyFor !== null}
        onClose={() => setFamilyFor(null)}
        chord={familyFor !== null ? built[familyFor] ?? null : null}
        working={familyFor !== null ? chords[familyFor] ?? null : null}
        tonicPc={tonicPc}
        simple={styleId === "pop" || styleId === "house"}
        onInsert={(wcs) => { if (familyFor !== null) insertBefore(familyFor, wcs); }}
      />

      <MelodyModal
        open={melodyOpen}
        onClose={() => setMelodyOpen(false)}
        chords={built}
        voices={voices}
        tonicPc={tonicPc}
        groove={groove}
        bpm={bpm}
        instrument={instrument}
        name={loadedProg?.name ?? "progression"}
        opts={melodyOpts}
        onOptsChange={setMelodyOpts}
      />

      <GrooveModal
        open={grooveOpen}
        onClose={() => setGrooveOpen(false)}
        chords={built}
        voices={voices}
        groove={groove}
        onChange={setGroove}
        bpm={bpm}
        name={loadedProg?.name ?? "progression"}
      />
    </div>
  );
}

/**
 * The bit that was missing: what actually MOVES between two chords. The 7th of
 * one chord falling a semitone into the 3rd of the next is the whole engine of
 * jazz harmony — so we show it, every time.
 */
function VoiceLeading({ a, b, tonicPc }: { a: BuiltChord; b: BuiltChord; tonicPc: number }) {
  const moves = guideMotion(a, b, tonicPc);
  const motion = motionBetween(a, b);

  return (
    <div className="-my-1 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 font-mono text-[11px]">
      <span className="text-[var(--muted)]">↓</span>
      {moves.map((m, i) => {
        const half = Math.abs(m.semitones) === 1;
        const held = m.semitones === 0;
        return (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-[var(--muted)]">{m.label}</span>
            <span className={held ? "text-[var(--amber)]" : half ? "text-[var(--coral)]" : "text-[var(--muted)]"}>
              {m.fromName} → {m.toName}
            </span>
            <span
              className={[
                "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                held
                  ? "bg-[var(--amber)]/15 text-[var(--amber)]"
                  : half
                    ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                    : "bg-white/5 text-[var(--muted)]",
              ].join(" ")}
            >
              {held ? "common tone" : half ? "½ step" : `${Math.abs(m.semitones)} semitones`}
            </span>
          </span>
        );
      })}
      <span className="text-[var(--muted)]">
        voices: {motion.summary} · {motion.totalMotion} semitones of movement
      </span>
    </div>
  );
}

function Label({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <span
      className={[
        "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]",
        inline ? "shrink-0" : "mb-2 block",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
