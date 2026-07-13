"use client";

import { STRING_LABELS, TUNING, type FretDot } from "@/lib/guitar";

const NUT = 34;      // width of the nut / label gutter
const FW = 62;       // fret width
const SG = 26;       // string gap
const PAD_T = 20;
const PAD_B = 22;

const MARKERS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE = [12, 24];

type Props = {
  dots: FretDot[];
  /** strings with no dot are drawn muted (×) — chord charts only */
  showMutes?: boolean;
  /** first and last fret drawn */
  from?: number;
  to?: number;
  showDegrees?: boolean;
  dim?: boolean;
  fit?: boolean;
  /** click a note to hear it */
  onNote?: (midi: number) => void;
  activeKey?: string | null; // "string:fret" currently sounding
};

export default function Fretboard({
  dots, showMutes, from = 0, to = 15, showDegrees, dim, fit, onNote, activeKey,
}: Props) {
  const frets = to - from;
  const width = NUT + frets * FW + 16;
  const height = PAD_T + (TUNING.length - 1) * SG + PAD_B;

  const played = new Set(dots.map((d) => d.string));
  const stringY = (s: number) => PAD_T + (TUNING.length - 1 - s) * SG; // low E at the bottom
  const fretX = (f: number) => NUT + (f - from) * FW;
  const dotX = (f: number) => (f === 0 ? NUT - 14 : fretX(f) - FW / 2); // open notes sit behind the nut

  const color = (role: FretDot["role"]) =>
    role === "root" ? "#f2603f"
      : role === "bass" ? "#8b62e8"
        : role === "scale" ? "#7b5fd0"
          : "#eaa03f";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Fretboard: ${dots.map((d) => d.name).join(", ")}`}
      className={fit ? "block h-full w-full select-none" : "block h-auto w-full select-none"}
      width={fit ? undefined : "100%"}
      style={{ opacity: dim ? 0.3 : 1, transition: "opacity .3s ease" }}
    >
      {/* fingerboard */}
      <rect
        x={NUT} y={PAD_T - 10} width={frets * FW} height={(TUNING.length - 1) * SG + 20}
        fill="#1a1520" rx={2}
      />

      {/* inlays */}
      {Array.from({ length: frets }, (_, i) => from + i + 1).map((f) => {
        const cx = fretX(f) - FW / 2;
        const cy = PAD_T + ((TUNING.length - 1) * SG) / 2;
        if (DOUBLE.includes(f)) {
          return (
            <g key={`i${f}`}>
              <circle cx={cx} cy={cy - SG} r={4} fill="#3a3346" />
              <circle cx={cx} cy={cy + SG} r={4} fill="#3a3346" />
            </g>
          );
        }
        if (MARKERS.includes(f)) return <circle key={`i${f}`} cx={cx} cy={cy} r={4} fill="#3a3346" />;
        return null;
      })}

      {/* frets */}
      {Array.from({ length: frets + 1 }, (_, i) => from + i).map((f) => (
        <line
          key={`f${f}`}
          x1={fretX(f)} y1={PAD_T - 10} x2={fretX(f)} y2={PAD_T + (TUNING.length - 1) * SG + 10}
          stroke={f === 0 ? "#e8e0d0" : "#4a4358"}
          strokeWidth={f === 0 ? 5 : 2}
        />
      ))}

      {/* strings (thicker at the bottom = wound strings) */}
      {TUNING.map((_, s) => (
        <line
          key={`s${s}`}
          x1={NUT} y1={stringY(s)} x2={fretX(to)} y2={stringY(s)}
          stroke="#8a8296" strokeWidth={0.7 + (5 - s) * 0.32}
        />
      ))}

      {/* string names, and × for muted strings */}
      {TUNING.map((_, s) => {
        const muted = showMutes && !played.has(s);
        return (
          <text
            key={`l${s}`}
            x={12} y={stringY(s) + 4} textAnchor="middle" className="font-mono"
            fontSize={12} fontWeight={700}
            fill={muted ? "#5d5566" : "#9a9186"}
          >
            {muted ? "×" : STRING_LABELS[s]}
          </text>
        );
      })}

      {/* fret numbers */}
      {Array.from({ length: frets }, (_, i) => from + i + 1).map((f) => (
        <text
          key={`n${f}`}
          x={fretX(f) - FW / 2} y={height - 6} textAnchor="middle" className="font-mono"
          fontSize={10} fill="#6c6472"
        >
          {f}
        </text>
      ))}

      {/* the notes */}
      {dots.map((d, i) => {
        const cx = dotX(d.fret);
        const cy = stringY(d.string);
        const r = d.role === "scale" ? 9.5 : 11.5;
        const isActive = activeKey === `${d.string}:${d.fret}`;
        return (
          <g
            key={i}
            onClick={onNote ? () => onNote(TUNING[d.string] + d.fret) : undefined}
            style={onNote ? { cursor: "pointer" } : undefined}
          >
            <circle cx={cx} cy={cy} r={r} fill={color(d.role)} stroke="#0b0910" strokeWidth={1.5} />
            {isActive && (
              <circle cx={cx} cy={cy} r={r + 3.5} fill="none" stroke="#efe9df" strokeWidth={2.5} />
            )}
            <text
              x={cx} y={cy + 3.4} textAnchor="middle" className="font-mono"
              fontSize={showDegrees ? 9 : 9.5} fontWeight={700} fill="#1b1018"
            >
              {showDegrees ? d.degree : d.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
