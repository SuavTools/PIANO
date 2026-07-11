"use client";

import { isWhite, type KeyRange, type Note } from "@/lib/music";

const WW = 26; // white key width
const WH = 132; // white key height
const BW = 16; // black key width
const BH = 82; // black key height

type Props = {
  range: KeyRange;
  notes: Note[];
  dim?: boolean; // fade when another card is the one currently playing
};

export default function Piano({ range, notes, dim }: Props) {
  const activeName = new Map<number, string>();
  const rootMidis = new Set<number>();
  for (const n of notes) {
    activeName.set(n.midi, n.name);
    if (n.isRoot) rootMidis.add(n.midi);
  }

  // lay out white keys left-to-right; index them so black keys can hang between
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

  const fillFor = (midi: number, white: boolean) => {
    if (!activeName.has(midi)) return white ? "url(#ivory)" : "#1b1722";
    return rootMidis.has(midi) ? "url(#coral)" : "url(#amber)";
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${WH}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Piano voicing: ${notes.map((n) => n.name).join(", ")}`}
      className="block h-auto w-full select-none"
      style={{ opacity: dim ? 0.32 : 1, transition: "opacity .3s ease" }}
    >
      <defs>
        <linearGradient id="ivory" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6efe1" />
          <stop offset="1" stopColor="#dcd2bf" />
        </linearGradient>
        <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd58a" />
          <stop offset="1" stopColor="#eaa03f" />
        </linearGradient>
        <linearGradient id="coral" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9d78" />
          <stop offset="1" stopColor="#f2603f" />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* white keys */}
      {whites.map(({ midi, x }) => {
        const active = activeName.has(midi);
        return (
          <g key={midi} filter={active ? "url(#glow)" : undefined}>
            <rect
              x={x + 0.6}
              y={0}
              width={WW - 1.2}
              height={WH}
              rx={3}
              fill={fillFor(midi, true)}
              stroke="#00000022"
              strokeWidth={0.75}
            />
            {active && (
              <text
                x={x + WW / 2}
                y={WH - 11}
                textAnchor="middle"
                className="font-mono"
                fontSize={9.5}
                fontWeight={700}
                fill="#2a1c10"
              >
                {activeName.get(midi)}
              </text>
            )}
          </g>
        );
      })}

      {/* black keys on top */}
      {blacks.map(({ midi, x }) => {
        const active = activeName.has(midi);
        return (
          <g key={midi} filter={active ? "url(#glow)" : undefined}>
            <rect
              x={x}
              y={0}
              width={BW}
              height={BH}
              rx={2.5}
              fill={fillFor(midi, false)}
              stroke="#00000055"
              strokeWidth={0.5}
            />
            {active && (
              <text
                x={x + BW / 2}
                y={BH - 8}
                textAnchor="middle"
                className="font-mono"
                fontSize={8}
                fontWeight={700}
                fill={rootMidis.has(midi) ? "#2a1206" : "#3a2708"}
              >
                {activeName.get(midi)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
