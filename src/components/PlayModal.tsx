"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Piano from "./Piano";
import Fretboard from "./Fretboard";
import { playChord, playNote, playProgression, type ProgressionHandle } from "@/lib/audio";
import type { Shape } from "@/lib/guitar";
import { KEYS, type BuiltChord, type KeyRange } from "@/lib/music";
import type { Instrument } from "./ChordCard";

type Props = {
  open: boolean;
  onClose: () => void;
  chords: BuiltChord[];
  range: KeyRange;
  tonicPc: number;
  bpm: number;
  instrument: Instrument;
  shapes: Shape[][];
  voices: number[][];
};

export default function PlayModal({
  open, onClose, chords, range, tonicPc, bpm, instrument, shapes, voices,
}: Props) {
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(bpm);
  const handleRef = useRef<ProgressionHandle | null>(null);

  const stop = () => {
    handleRef.current?.stop();
    handleRef.current = null;
    setCurrent(null);
    setPlaying(false);
  };

  useEffect(() => () => { handleRef.current?.stop(); }, []);

  // never leave a transport running behind a closed modal
  const close = () => { stop(); onClose(); };

  const play = () => {
    if (handleRef.current) return stop();
    if (!chords.length) return;
    handleRef.current = playProgression(voices, tempo, (i) => setCurrent(i), () => stop());
    setPlaying(true);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Performance view"
      subtitle={`${KEYS[tonicPc].name} · ${chords.length} chords · tap any chord to hear it`}
      actions={
        <>
          <div className="hidden items-center gap-2 sm:flex">
            <input
              type="range" min={50} max={110} value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="accent-[var(--amber)]" aria-label="Tempo"
            />
            <span className="w-14 font-mono text-xs tabular-nums text-[var(--muted)]">{tempo} bpm</span>
          </div>
          <button
            type="button"
            onClick={play}
            className={[
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              playing ? "bg-[var(--coral)] text-black" : "bg-[var(--ink)] text-black hover:opacity-90",
            ].join(" ")}
          >
            {playing ? "■ Stop" : "▶ Play"}
          </button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        {chords.map((ch, i) => {
          const lit = current === i;
          const dimmed = current !== null && current !== i;
          const shape = shapes[i]?.length ? shapes[i][ch.shape % shapes[i].length] : null;
          const chips =
            instrument === "guitar" && shape
              ? [...shape.dots].sort((a, b) => a.string - b.string).map((d) => ({ name: d.name, role: d.role }))
              : [...ch.notes].sort((a, b) => a.midi - b.midi).map((n) => ({ name: n.name, role: n.role }));
          return (
            <div
              key={i}
              className={[
                "flex min-h-[120px] flex-1 items-center gap-4 rounded-xl border px-3 py-2 text-left transition-[border-color,box-shadow] duration-200",
                lit
                  ? "border-[var(--amber)] shadow-[0_0_0_1px_var(--amber)]"
                  : "border-[var(--line)]",
              ].join(" ")}
              style={{ background: "var(--panel)" }}
            >
              {/* chord info */}
              <div className="flex w-32 shrink-0 flex-col gap-1 sm:w-44">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--amber)]">{ch.roman}</span>
                </div>
                <button
                  type="button"
                  onClick={() => playChord(voices[i], { roll: true })}
                  title={`Play ${ch.symbol}`}
                  className="truncate text-left font-serif text-2xl leading-none text-[var(--ink)] transition hover:text-[var(--coral)] sm:text-3xl"
                >
                  {ch.symbol}
                </button>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {chips.map((n, k) => (
                    <span
                      key={k}
                      className={[
                        "font-mono text-[11px]",
                        n.role === "bass"
                          ? "text-[var(--violet)]"
                          : n.role === "root"
                            ? "text-[var(--coral)]"
                            : "text-[var(--muted)]",
                      ].join(" ")}
                    >
                      {n.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* the instrument — fills the row height so it all stays on screen */}
              <div className="h-full min-h-0 min-w-0 flex-1">
                {instrument === "piano" ? (
                  <Piano range={range} notes={ch.notes} scalePcs={ch.scalePcs} dim={dimmed} fit onNote={playNote} />
                ) : shape ? (
                  <Fretboard dots={shape.dots} showMutes dim={dimmed} fit onNote={playNote} />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
