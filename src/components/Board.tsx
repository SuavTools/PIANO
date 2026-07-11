"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChordCard from "./ChordCard";
import { playProgression, type ProgressionHandle } from "@/lib/audio";
import {
  KEYS,
  STYLES,
  buildProgression,
  rangeForChords,
} from "@/lib/music";

export default function Board() {
  const [tonicPc, setTonicPc] = useState(0); // C
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [progId, setProgId] = useState(STYLES[0].progressions[0].id);
  const [bpm, setBpm] = useState(72);
  const [current, setCurrent] = useState<number | null>(null); // chord being played
  const handleRef = useRef<ProgressionHandle | null>(null);

  const style = useMemo(() => STYLES.find((s) => s.id === styleId)!, [styleId]);
  const prog = useMemo(
    () => style.progressions.find((p) => p.id === progId) ?? style.progressions[0],
    [style, progId],
  );

  // keep the selected progression valid when the style changes
  useEffect(() => {
    if (!style.progressions.some((p) => p.id === progId)) {
      setProgId(style.progressions[0].id);
    }
  }, [style, progId]);

  const chords = useMemo(() => buildProgression(prog, tonicPc), [prog, tonicPc]);
  const range = useMemo(() => rangeForChords(chords), [chords]);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setCurrent(null);
  };

  // stop playback whenever the material changes underfoot
  useEffect(() => stop(), [tonicPc, progId, styleId]);
  useEffect(() => () => stop(), []); // unmount

  const play = () => {
    if (handleRef.current) {
      stop();
      return;
    }
    handleRef.current = playProgression(
      chords.map((c) => c.notes.map((n) => n.midi)),
      bpm,
      (i) => setCurrent(i),
      () => stop(),
    );
  };

  const playing = handleRef.current !== null;
  const tonicName = KEYS[tonicPc].name;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      {/* ---- control bar ---- */}
      <div className="sticky top-0 z-20 -mx-4 mb-8 border-b border-[var(--line)] bg-[var(--bg)]/85 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        {/* keys */}
        <Label>Key</Label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {KEYS.map((k) => (
            <button
              key={k.pc}
              type="button"
              onClick={() => setTonicPc(k.pc)}
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Label>Style</Label>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyleId(s.id)}
                  title={s.tagline}
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
          </div>

          {/* transport */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label inline>Tempo</Label>
              <input
                type="range"
                min={50}
                max={110}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="accent-[var(--amber)]"
                aria-label="Tempo in BPM"
              />
              <span className="w-14 font-mono text-xs text-[var(--muted)] tabular-nums">{bpm} bpm</span>
            </div>
            <button
              type="button"
              onClick={play}
              className={[
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
                playing
                  ? "bg-[var(--coral)] text-black"
                  : "bg-[var(--ink)] text-black hover:opacity-90",
              ].join(" ")}
            >
              {playing ? "■ Stop" : "▶ Play progression"}
            </button>
          </div>
        </div>

        {/* progression chooser */}
        <div className="mt-4">
          <Label>Progression</Label>
          <div className="flex flex-wrap gap-1.5">
            {style.progressions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProgId(p.id)}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  p.id === prog.id
                    ? "bg-white/12 text-[var(--ink)] ring-1 ring-[var(--line-bright)]"
                    : "text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- now-playing heading ---- */}
      <div className="mb-6">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {tonicName} · {style.name}
        </div>
        <h2 className="font-serif text-3xl text-[var(--ink)] sm:text-4xl" style={{ textWrap: "balance" }}>
          {prog.name}
        </h2>
        <p className="mt-1 max-w-prose text-sm text-[var(--muted)]">{prog.blurb}</p>
      </div>

      {/* ---- the board ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {chords.map((ch, i) => (
          <ChordCard
            key={`${prog.id}-${i}`}
            chord={ch}
            range={range}
            index={i}
            playing={current === i}
            someoneElsePlaying={current !== null && current !== i}
          />
        ))}
      </div>

      <p className="mt-8 font-mono text-xs text-[var(--muted)]">
        Tap any card to hear the voicing · coral = root · amber = the color tones
      </p>
    </div>
  );
}

function Label({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <span
      className={[
        "font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]",
        inline ? "" : "mb-2 block",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
