"use client";

import { isWhite, type KeyRange, type Note } from "@/lib/music";

const WW = 26;   // white key width
const WH = 140;  // white key height
const BW = 16;   // black key width
const BH = 88;   // black key height

type Props = {
  range: KeyRange;
  notes: Note[];
  /** pitch-classes ghosted in behind the chord as dots */
  scalePcs?: number[] | null;
  dim?: boolean;
  /** scale degree labels under each note (used in the scale view) */
  showDegrees?: boolean;
  /** fill the parent's height instead of the width — for the performance view */
  fit?: boolean;
  /** click a key to hear that single note */
  onNote?: (midi: number) => void;
  /** a note the transport is currently sounding — rings it */
  activeMidi?: number | null;
};

export default function Piano({ range, notes, scalePcs, dim, showDegrees, fit, onNote, activeMidi }: Props) {
  const byMidi = new Map(notes.map((n) => [n.midi, n]));
  const ghosts = new Set(scalePcs ?? []);

  const whites: { midi: number; x: number }[] = [];
  const whiteX = new Map<number, number>();
  for (let m = range.low; m <= range.high; m++) {
    if (isWhite(m)) {
      const x = whites.length * WW;
      whites.push({ midi: m, x });
      whiteX.set(m, x);
    }
  }
  const width = whites.length * WW;

  const blacks: { midi: number; x: number }[] = [];
  for (let m = range.low; m <= range.high; m++) {
    if (!isWhite(m)) {
      const lower = whiteX.get(m - 1);
      if (lower !== undefined) blacks.push({ midi: m, x: lower + WW - BW / 2 });
    }
  }

  const fill = (n: Note | undefined, white: boolean) => {
    if (!n) return white ? "url(#ivory)" : "#1b1722";
    if (n.role === "bass") return "url(#violet)";
    if (n.role === "upper") return "url(#teal)";
    if (n.role === "scale") return "url(#scale)";
    if (n.role === "root") return "url(#coral)";
    return "url(#amber)";
  };

  const label = notes.map((n) => `${n.name}${n.role === "bass" ? " (bass)" : ""}`).join(", ");

  return (
    <svg
      viewBox={`0 0 ${width} ${WH + 14}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Keyboard: ${label}`}
      className={fit ? "block h-full w-full select-none" : "block h-auto w-full select-none"}
      width={fit ? undefined : "100%"}
      style={{ opacity: dim ? 0.3 : 1, transition: "opacity .3s ease" }}
    >
      <defs>
        <linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6efe1" /><stop offset="1" stopColor="#dcd2bf" />
        </linearGradient>
        <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd58a" /><stop offset="1" stopColor="#eaa03f" />
        </linearGradient>
        <linearGradient id="coral" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9d78" /><stop offset="1" stopColor="#f2603f" />
        </linearGradient>
        <linearGradient id="violet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c3a9ff" /><stop offset="1" stopColor="#8b62e8" />
        </linearGradient>
        <linearGradient id="teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ef0e0" /><stop offset="1" stopColor="#35b8a2" />
        </linearGradient>
        <linearGradient id="scale" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9a2f5" /><stop offset="1" stopColor="#7b5fd0" />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* white keys */}
      {whites.map(({ midi, x }) => {
        const n = byMidi.get(midi);
        const ghost = !n && ghosts.has(((midi % 12) + 12) % 12);
        const isC = ((midi % 12) + 12) % 12 === 0;
        return (
          <g
            key={midi}
            filter={n ? "url(#glow)" : undefined}
            onClick={onNote ? () => onNote(midi) : undefined}
            style={onNote ? { cursor: "pointer" } : undefined}
          >
            <rect
              x={x + 0.6} y={0} width={WW - 1.2} height={WH} rx={3}
              fill={fill(n, true)} stroke="#00000022" strokeWidth={0.75}
            />
            {activeMidi === midi && (
              <rect
                x={x + 0.6} y={0} width={WW - 1.2} height={WH} rx={3}
                fill="none" stroke="#efe9df" strokeWidth={3}
              />
            )}
            {ghost && <circle cx={x + WW / 2} cy={WH - 16} r={4} fill="#eaa03f" opacity={0.42} />}
            {n && showDegrees && n.degree && (
              <text
                x={x + WW / 2} y={WH - 24} textAnchor="middle" className="font-mono"
                fontSize={8.5} fontWeight={700} fill="#00000077"
              >
                {n.degree}
              </text>
            )}
            {n && (
              <text
                x={x + WW / 2} y={WH - 11} textAnchor="middle" className="font-mono"
                fontSize={9.5} fontWeight={700} fill="#2a1c10"
              >
                {n.name}
              </text>
            )}
            {isC && !n && (
              <text
                x={x + WW / 2} y={WH + 11} textAnchor="middle" className="font-mono"
                fontSize={8} fill="#6c6472"
              >
                {`C${Math.floor(midi / 12) - 1}`}
              </text>
            )}
          </g>
        );
      })}

      {/* black keys */}
      {blacks.map(({ midi, x }) => {
        const n = byMidi.get(midi);
        const ghost = !n && ghosts.has(((midi % 12) + 12) % 12);
        return (
          <g
            key={midi}
            filter={n ? "url(#glow)" : undefined}
            onClick={onNote ? () => onNote(midi) : undefined}
            style={onNote ? { cursor: "pointer" } : undefined}
          >
            <rect
              x={x} y={0} width={BW} height={BH} rx={2.5}
              fill={fill(n, false)} stroke="#00000055" strokeWidth={0.5}
            />
            {activeMidi === midi && (
              <rect
                x={x} y={0} width={BW} height={BH} rx={2.5}
                fill="none" stroke="#efe9df" strokeWidth={2.5}
              />
            )}
            {ghost && <circle cx={x + BW / 2} cy={BH - 12} r={3.4} fill="#eaa03f" opacity={0.6} />}
            {n && showDegrees && n.degree && (
              <text
                x={x + BW / 2} y={BH - 20} textAnchor="middle" className="font-mono"
                fontSize={7.5} fontWeight={700} fill="#00000088"
              >
                {n.degree}
              </text>
            )}
            {n && (
              <text
                x={x + BW / 2} y={BH - 8} textAnchor="middle" className="font-mono"
                fontSize={8} fontWeight={700} fill="#2a1206"
              >
                {n.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
