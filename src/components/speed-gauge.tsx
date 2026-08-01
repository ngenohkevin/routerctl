'use client';

import { useEffect, useRef, useState } from 'react';

interface SpeedGaugeProps {
  value: number; // Mbps (or ms during ping)
  max?: number;
  label: string;
  phase?: 'idle' | 'ping' | 'download' | 'upload' | 'done';
  ping?: number; // ms — shown during ping phase
}

// Per-phase colour pairs [core, glow] used for the gradient arc + drop shadow.
const PHASE_COLORS: Record<NonNullable<SpeedGaugeProps['phase']>, [string, string]> = {
  download: ['hsl(142, 76%, 45%)', 'hsl(142, 76%, 36%)'],
  upload: ['hsl(217, 91%, 65%)', 'hsl(217, 91%, 55%)'],
  ping: ['hsl(45, 93%, 55%)', 'hsl(45, 93%, 47%)'],
  done: ['hsl(142, 76%, 45%)', 'hsl(142, 76%, 36%)'],
  idle: ['hsl(215, 20%, 55%)', 'hsl(215, 20%, 45%)'],
};

// useSmoothed eases a displayed number toward `target` every animation frame,
// so the gauge reads continuously even though SSE values only arrive ~5x/sec.
// `resetKey` snaps instantly (no cross-unit sweep) when the measured quantity
// changes — e.g. ms during ping → Mbps during download.
function useSmoothed(target: number, resetKey: string): number {
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(target);
  const keyRef = useRef(resetKey);

  useEffect(() => {
    // Switching measured quantity (ping ms ↔ Mbps): snap the baseline so the
    // loop settles to the new value next frame instead of sweeping across.
    if (keyRef.current !== resetKey) {
      keyRef.current = resetKey;
      displayRef.current = target;
    }

    // The effect re-runs on every `target` change, so the captured value is
    // always the latest; ease the persisted display toward it each frame.
    // All setDisplay calls happen inside the rAF callback (never synchronously
    // in the effect body).
    let raf = 0;
    const loop = () => {
      const cur = displayRef.current;
      const delta = target - cur;
      if (Math.abs(delta) < 0.05) {
        displayRef.current = target;
        setDisplay(target);
        return;
      }
      displayRef.current = cur + delta * 0.18; // easeOut factor per frame
      setDisplay(displayRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, resetKey]);

  return display;
}

export function SpeedGauge({ value, max = 100, label, phase = 'idle', ping = 0 }: SpeedGaugeProps) {
  const radius = 90;
  const strokeWidth = 12;
  const center = 110;
  const startAngle = 135;
  const endAngle = 405;
  const sweep = endAngle - startAngle;

  const circumference = (sweep / 360) * 2 * Math.PI * radius;

  const isPing = phase === 'ping';
  const rawTarget = isPing ? ping : value;
  // Snap the tween whenever we switch the measured quantity (ping ms vs Mbps).
  const smooth = useSmoothed(rawTarget, isPing ? 'ping' : 'speed');

  const clamped = Math.min(Math.max(smooth, 0), max);
  const progress = max > 0 ? clamped / max : 0;
  const offset = circumference * (1 - progress);

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  const [core, glow] = PHASE_COLORS[phase] ?? PHASE_COLORS.idle;
  const gradId = `speed-grad-${phase}`;

  const displayValue = isPing ? ping : value; // use raw for show/hide decisions
  const showValue = displayValue > 0;
  const unit = isPing ? 'ms' : 'Mbps';
  const showArc = clamped > 0 && (phase === 'download' || phase === 'upload' || phase === 'done');
  const showPulse = phase === 'ping';

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="180" viewBox="0 0 220 180">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={glow} />
            <stop offset="100%" stopColor={core} />
          </linearGradient>
          <filter id={`${gradId}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="hsl(215, 20%, 20%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Progress arc — driven by the smoothed value, so it flows */}
        {showArc && (
          <path
            d={bgPath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter={`url(#${gradId}-glow)`}
          />
        )}

        {/* Pulsing indicator during ping phase (no speed data yet) */}
        {showPulse && (
          <path
            d={bgPath}
            fill="none"
            stroke={core}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.75}
            opacity={0.6}
          >
            <animate
              attributeName="stroke-dashoffset"
              values={`${circumference * 0.85};${circumference * 0.6};${circumference * 0.85}`}
              dur="1.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0.8;0.4"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </path>
        )}

        {/* Value text — animated count */}
        <text
          x={center}
          y={center - 10}
          textAnchor="middle"
          className="fill-foreground tabular-nums"
          fontSize="36"
          fontWeight="bold"
        >
          {showValue ? smooth.toFixed(1) : '—'}
        </text>
        <text
          x={center}
          y={center + 15}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="14"
        >
          {unit}
        </text>

        {/* Label — truncate long server names */}
        <text
          x={center}
          y={center + 35}
          textAnchor="middle"
          fontSize="11"
          fill={core}
          textLength={label.length > 30 ? '180' : undefined}
          lengthAdjust="spacing"
        >
          {label.length > 40 ? label.slice(0, 38) + '...' : label}
        </text>
      </svg>
    </div>
  );
}
