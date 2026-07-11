"use client";

import { useState } from "react";
import Piano from "./Piano";
import { playChord } from "@/lib/audio";
import type { BuiltChord, KeyRange } from "@/lib/music";

type Props = {
  chord: BuiltChord;
  range: KeyRange;
  index: number;
  /** true while the progression transport is on this chord */
  playing: boolean;
  /** true while the transport is playing some *other* chord */
  someoneElsePlaying: boolean;
};

export default function ChordCard({ chord, range, index, playing, someoneElsePlaying }: Props) {
  const [pressed, setPressed] = useState(false);

  const hit = () => {
    playChord(chord.notes.map((n) => n.midi), { roll: true });
    setPressed(true);
    window.setTimeout(() => setPressed(false), 260);
  };

  const lit = playing || pressed;

  return (
    <button
      type="button"
      onClick={hit}
      aria-label={`Play ${chord.symbol}`}
      className={[
        "group relative flex flex-col gap-3 rounded-2xl border p-4 text-left",
        "transition-[transform,box-shadow,border-color] duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)]",
        lit
          ? "border-[var(--amber)] shadow-[0_0_0_1px_var(--amber),0_18px_50px_-20px_rgba(240,180,94,0.55)]"
          : "border-[var(--line)] hover:border-[var(--line-bright)]",
        "hover:-translate-y-0.5",
      ].join(" ")}
      style={{ background: "var(--panel)" }}
    >
      {/* header: roman numeral + count, chord symbol */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs tracking-[0.15em] text-[var(--amber)]">{chord.roman}</span>
        <span className="font-mono text-[10px] text-[var(--muted)]">{index + 1}</span>
      </div>
      <div className="font-serif text-2xl leading-none text-[var(--ink)]" style={{ fontOpticalSizing: "auto" }}>
        {chord.symbol}
      </div>

      {/* the keyboard */}
      <div className="mt-1 rounded-lg bg-[#0b0910] p-2 ring-1 ring-black/40">
        <Piano range={range} notes={chord.notes} dim={someoneElsePlaying} />
      </div>

      {/* note chips, bottom to top like the hand stacks them */}
      <div className="flex flex-wrap gap-1.5">
        {[...chord.notes]
          .sort((a, b) => a.midi - b.midi)
          .map((n, i) => (
            <span
              key={i}
              className={[
                "rounded-md px-1.5 py-0.5 font-mono text-[11px]",
                n.isRoot
                  ? "bg-[var(--coral)]/15 text-[var(--coral)] ring-1 ring-[var(--coral)]/30"
                  : "bg-white/5 text-[var(--muted)] ring-1 ring-white/10",
              ].join(" ")}
            >
              {n.name}
            </span>
          ))}
      </div>

      <span className="pointer-events-none absolute right-3 bottom-3 font-mono text-[10px] text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100">
        ▶ play
      </span>
    </button>
  );
}
