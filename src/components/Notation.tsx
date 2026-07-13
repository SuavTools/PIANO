"use client";

import { STRING_LABELS, TUNING, FRET_COUNT } from "@/lib/guitar";
import type { ExNote } from "@/lib/exercises";
import type { BuiltChord } from "@/lib/music";

const COLW = 34;
const GUTTER = 30;

const roleColor = (role: ExNote["role"]) =>
  role === "target" ? "#f2603f"
    : role === "chord" ? "#eaa03f"
      : role === "chromatic" || role === "approach" ? "#9b7cf0"
        : "#9a9186";

type Props = {
  notes: ExNote[];
  chords: BuiltChord[];
  activeIdx: number | null;
  onNote: (midi: number) => void;
  /** underline the downbeats — used to show the bebop scale's alignment */
  markDownbeats?: boolean;
};

/**
 * Choose a string/fret for every note so the hand barely moves — a tab you can
 * actually play, rather than one that's technically correct and unplayable.
 */
type Placed = { string: number; fret: number } | null;

function placeOnNeck(notes: ExNote[]): Placed[] {
  const out: Placed[] = [];
  let prevFret = 5;

  for (const n of notes) {
    let best: { string: number; fret: number; cost: number } | null = null;
    for (let s = 0; s < TUNING.length; s++) {
      const f = n.midi - TUNING[s];
      if (f < 0 || f > FRET_COUNT) continue;
      // stay near the last fret; open strings break the position, so mild penalty
      const cost = Math.abs(f - prevFret) + (f === 0 ? 2 : 0);
      if (!best || cost < best.cost) best = { string: s, fret: f, cost };
    }
    if (best) prevFret = best.fret;
    out.push(best ? { string: best.string, fret: best.fret } : null);
  }
  return out;
}

// ---------------------------------------------------------------------------
// GUITAR TAB — real tab, with the fingering chosen to keep your hand still.
// ---------------------------------------------------------------------------
export function TabStaff({ notes, chords, activeIdx, onNote, markDownbeats }: Props) {
  const SG = 20;
  const top = 26;
  const height = top + 5 * SG + 26;
  const width = GUTTER + notes.length * COLW + 10;

  const placed = placeOnNeck(notes);
  const stringY = (s: number) => top + (TUNING.length - 1 - s) * SG;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} className="block select-none">
        {/* chord names + bar lines */}
        {chords.map((ch, ci) => {
          const first = notes.findIndex((n) => n.chordIndex === ci);
          if (first === -1) return null;
          const x = GUTTER + first * COLW;
          return (
            <g key={`c${ci}`}>
              <line x1={x - 3} y1={top - 12} x2={x - 3} y2={stringY(0) + 8} stroke="#4a4358" strokeWidth={1.5} />
              <text x={x} y={14} className="font-mono" fontSize={12} fontWeight={700} fill="#f0b45e">
                {ch.symbol}
              </text>
            </g>
          );
        })}

        {/* strings */}
        {TUNING.map((_, s) => (
          <g key={`s${s}`}>
            <line
              x1={GUTTER - 3} y1={stringY(s)} x2={width - 6} y2={stringY(s)}
              stroke="#3a3346" strokeWidth={1}
            />
            <text x={8} y={stringY(s) + 4} className="font-mono" fontSize={11} fontWeight={700} fill="#6c6472">
              {STRING_LABELS[s]}
            </text>
          </g>
        ))}

        {/* the fret numbers — this is the tab */}
        {placed.map((p, i) => {
          if (!p) return null;
          const n = notes[i];
          const x = GUTTER + i * COLW + COLW / 2 - 3;
          const y = stringY(p.string);
          const active = activeIdx === i;
          const label = String(p.fret);
          const w = 9 + label.length * 6;
          return (
            <g
              key={i}
              onClick={() => onNote(n.midi)}
              style={{ cursor: "pointer" }}
            >
              {/* knock out the string behind the number so it reads like tab */}
              <rect x={x - w / 2} y={y - 8} width={w} height={16} rx={3}
                fill={active ? "#efe9df" : "#0b0910"} />
              <text
                x={x} y={y + 4} textAnchor="middle" className="font-mono"
                fontSize={12} fontWeight={700}
                fill={active ? "#0b0910" : roleColor(n.role)}
              >
                {label}
              </text>
              {markDownbeats && n.beat % 2 === 0 && (
                <circle cx={x} cy={stringY(0) + 16} r={2} fill="#efe9df" opacity={0.7} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PIANO ROLL — pitch up the side, time across. You can see the shape of the
// line, which note names alone never give you.
// ---------------------------------------------------------------------------
export function PianoRoll({ notes, chords, activeIdx, onNote, markDownbeats }: Props) {
  if (!notes.length) return null;

  const lo = Math.min(...notes.map((n) => n.midi));
  const hi = Math.max(...notes.map((n) => n.midi));
  const rows: number[] = [];
  for (let m = hi; m >= lo; m--) rows.push(m); // high notes at the top

  const RH = 17;
  const top = 26;
  const height = top + rows.length * RH + 20;
  const width = GUTTER + 18 + notes.length * COLW + 10;
  const rowY = (midi: number) => top + rows.indexOf(midi) * RH;
  const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

  return (
    <div className="max-h-[420px] overflow-auto">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} className="block select-none">
        {/* pitch lanes — black-note rows shaded, like a piano roll */}
        {rows.map((m) => (
          <rect
            key={`r${m}`}
            x={GUTTER + 18} y={rowY(m)} width={notes.length * COLW} height={RH - 2}
            fill={isBlack(m) ? "#171320" : "#100d16"}
          />
        ))}

        {/* the keyboard down the side */}
        {rows.map((m) => (
          <g key={`k${m}`}>
            <rect
              x={GUTTER - 8} y={rowY(m)} width={24} height={RH - 2} rx={2}
              fill={isBlack(m) ? "#1b1722" : "#e8e0d0"}
              stroke="#00000044" strokeWidth={0.5}
            />
            <text
              x={GUTTER + 4} y={rowY(m) + RH / 2 + 2} textAnchor="middle" className="font-mono"
              fontSize={8} fontWeight={700} fill={isBlack(m) ? "#8a8296" : "#2a1c10"}
            >
              {((m % 12) + 12) % 12 === 0 ? `C${Math.floor(m / 12) - 1}` : ""}
            </text>
          </g>
        ))}

        {/* chord names + bar lines */}
        {chords.map((ch, ci) => {
          const first = notes.findIndex((n) => n.chordIndex === ci);
          if (first === -1) return null;
          const x = GUTTER + 18 + first * COLW;
          return (
            <g key={`c${ci}`}>
              <line x1={x} y1={top - 12} x2={x} y2={height - 18} stroke="#4a4358" strokeWidth={1.5} />
              <text x={x + 4} y={14} className="font-mono" fontSize={12} fontWeight={700} fill="#f0b45e">
                {ch.symbol}
              </text>
            </g>
          );
        })}

        {/* the notes */}
        {notes.map((n, i) => {
          const x = GUTTER + 18 + i * COLW;
          const y = rowY(n.midi);
          const active = activeIdx === i;
          return (
            <g key={i} onClick={() => onNote(n.midi)} style={{ cursor: "pointer" }}>
              <rect
                x={x + 1.5} y={y} width={COLW - 3} height={RH - 2} rx={3}
                fill={active ? "#efe9df" : roleColor(n.role)}
              />
              <text
                x={x + COLW / 2} y={y + RH / 2 + 2.5} textAnchor="middle" className="font-mono"
                fontSize={9} fontWeight={700} fill={active ? "#0b0910" : "#1b1018"}
              >
                {n.name}
              </text>
              {markDownbeats && n.beat % 2 === 0 && (
                <circle cx={x + COLW / 2} cy={height - 10} r={2} fill="#efe9df" opacity={0.7} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
