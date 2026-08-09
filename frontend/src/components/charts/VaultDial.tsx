import { useMemo } from "react";
import clsx from "clsx";

interface VaultDialProps {
  /** 0 to 100 */
  percent: number;
  size?: number;
  label?: string;
  sublabel?: string;
  tone?: "brass" | "green" | "red";
}

/**
 * The CloudVault signature element: a circular dial with tick marks around
 * the rim, echoing a bank-vault combination lock. Used anywhere a
 * percentage matters (upload progress, storage quota) so the metaphor pulls
 * double duty as real data visualization, not decoration.
 */
export function VaultDial({ percent, size = 88, label, sublabel, tone = "brass" }: VaultDialProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const toneColor = { brass: "#B8842E", green: "#2F8F6C", red: "#C1443C" }[tone];

  const ticks = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * 360;
      const isMajor = i % 6 === 0;
      return { angle, isMajor };
    });
  }, []);

  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* tick marks */}
        {ticks.map((t, i) => {
          const inner = radius + 6;
          const outer = t.isMajor ? radius + 11 : radius + 8.5;
          const rad = (t.angle * Math.PI) / 180;
          const cx = size / 2;
          const cy = size / 2;
          return (
            <line
              key={i}
              x1={cx + inner * Math.cos(rad)}
              y1={cy + inner * Math.sin(rad)}
              x2={cx + outer * Math.cos(rad)}
              y2={cy + outer * Math.sin(rad)}
              stroke="#D7DCE5"
              strokeWidth={t.isMajor ? 1.5 : 1}
            />
          );
        })}
        {/* track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#D7DCE5" strokeWidth={6} />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-medium text-ink tabular-nums">{Math.round(clamped)}%</span>
      </div>
      {label && (
        <div className="mt-2 text-center">
          <p className={clsx("text-xs font-medium text-ink leading-tight")}>{label}</p>
          {sublabel && <p className="text-[11px] text-steel-soft leading-tight">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}
