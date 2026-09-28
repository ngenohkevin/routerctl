'use client';

import { useEffect, useRef } from 'react';
import { GAUGE_TICKS, formatMbps, formatMs, fromScale, toScale } from '@/lib/speed';

export type GaugeTone = 'link' | 'air' | 'ink';

interface SpeedGaugeProps {
  /** Mbps in speed mode, ms in ping mode; null shows a dash. */
  value: number | null;
  mode: 'speed' | 'ping';
  tone: GaugeTone;
  /** Short word under the figure: "Download", "Ping", "Ready". */
  caption: string;
}

const TONE_VAR: Record<GaugeTone, string> = {
  link: 'var(--link)',
  air: 'var(--air)',
  ink: 'var(--ink-3)',
};

// Geometry: a 270° arc opening at the bottom, in a 240×204 box.
const CX = 120;
const CY = 116;
const R = 94;
const START = 135; // degrees, clockwise from +x (SVG y points down)
const SWEEP = 270;

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

const A0 = polar(START, R);
const A1 = polar(START + SWEEP, R);
const ARC = `M ${A0.x} ${A0.y} A ${R} ${R} 0 1 1 ${A1.x} ${A1.y}`;

// Critically damped spring: no overshoot, settles in ~0.5s. Live samples
// arrive every 125ms, so the needle glides between them instead of stepping.
const OMEGA = 9;
const SUBSTEP = 1 / 120;

interface Sim {
  x: number; // speed mode: gauge position 0..1; ping mode: ms
  v: number;
  target: number;
  mode: 'speed' | 'ping';
  blank: boolean;
  raf: number;
  last: number;
}

export function SpeedGauge({ value, mode, tone, caption }: SpeedGaugeProps) {
  const arcRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const knobRef = useRef<SVGGElement>(null);
  const numRef = useRef<SVGTextElement>(null);
  const sim = useRef<Sim>({ x: 0, v: 0, target: 0, mode, blank: true, raf: 0, last: 0 });

  // Draw the current simulated position straight into the SVG. Runs per
  // animation frame, so it touches the DOM rather than React state.
  function paint() {
    const s = sim.current;
    const pos = s.mode === 'speed' ? Math.min(Math.max(s.x, 0), 1) : 0;
    const lit = pos > 0.002 ? '1' : '0';
    for (const el of [arcRef.current, haloRef.current]) {
      if (!el) continue;
      el.style.strokeDashoffset = String(1 - pos);
      el.style.opacity = lit;
    }
    if (knobRef.current) {
      knobRef.current.setAttribute('transform', `rotate(${pos * SWEEP} ${CX} ${CY})`);
      knobRef.current.style.opacity = s.mode === 'speed' && !s.blank ? '1' : '0';
    }
    if (numRef.current) {
      numRef.current.textContent = s.blank
        ? '—'
        : s.mode === 'speed'
          ? formatMbps(fromScale(pos))
          : formatMs(Math.max(s.x, 0));
    }
  }

  function frame(now: number) {
    const s = sim.current;
    const dt = Math.min((now - s.last) / 1000, 0.05);
    s.last = now;
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const a = -OMEGA * OMEGA * (s.x - s.target) - 2 * OMEGA * s.v;
      s.v += a * h;
      s.x += s.v * h;
    }
    const eps = s.mode === 'speed' ? 1e-4 : 0.01;
    if (Math.abs(s.x - s.target) < eps && Math.abs(s.v) < eps * 10) {
      s.x = s.target;
      s.v = 0;
      s.raf = 0;
      paint();
      return;
    }
    paint();
    s.raf = requestAnimationFrame(frame);
  }

  useEffect(() => {
    const s = sim.current;
    const target = value == null ? 0 : mode === 'speed' ? toScale(value) : Math.max(value, 0);
    if (s.mode !== mode) {
      // Switching quantity (ms ↔ Mbps): start the new one from its own
      // zero instead of sweeping across units.
      s.mode = mode;
      s.x = mode === 'speed' ? 0 : target;
      s.v = 0;
    }
    s.blank = value == null;
    s.target = target;

    // Hidden pages get no animation frames, so a glide would freeze halfway
    // (a backgrounded phone would come back to a stale figure): snap instead.
    const reduced =
      document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      s.x = target;
      s.v = 0;
      paint();
      return;
    }
    if (!s.raf) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(frame);
    }
    // frame/paint only read refs, so the running loop never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  useEffect(() => {
    const s = sim.current;
    // Returning to the page: land on the latest value at once.
    const onVisible = () => {
      if (document.hidden) return;
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.x = s.target;
      s.v = 0;
      paint();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
     
  }, []);

  const color = TONE_VAR[tone];

  return (
    <svg
      viewBox="0 0 240 204"
      className="w-full max-w-[300px] select-none"
      role="img"
      aria-label={value == null ? caption : `${caption} ${mode === 'speed' ? formatMbps(value) + ' Mbps' : formatMs(value) + ' ms'}`}
    >
      {/* Track */}
      <path d={ARC} fill="none" stroke="var(--inset)" strokeWidth={12} strokeLinecap="round" />
      <path d={ARC} fill="none" stroke="var(--hairline)" strokeWidth={12} strokeLinecap="round" strokeOpacity={0.5} strokeDasharray="0.002 0.123" pathLength={1} />

      {/* Tick labels — fixed scale, never re-fitted between tests */}
      {GAUGE_TICKS.map((t, i) => {
        const p = polar(START + (i / (GAUGE_TICKS.length - 1)) * SWEEP, R - 24);
        return (
          <text
            key={t}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            className="num font-mono"
            fill="var(--ink-4)"
          >
            {t === 1000 ? '1k' : t}
          </text>
        );
      })}

      {/* Lit arc + soft halo, the way a front-panel LED glows */}
      <path
        ref={haloRef}
        d={ARC}
        fill="none"
        stroke={color}
        strokeWidth={22}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1}
        strokeOpacity={0.12}
        style={{ transition: 'stroke 200ms var(--ease-out)', opacity: 0 }}
      />
      <path
        ref={arcRef}
        d={ARC}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1}
        style={{ transition: 'stroke 200ms var(--ease-out)', opacity: 0 }}
      />

      {/* Knob at the arc's leading edge */}
      <g ref={knobRef} style={{ opacity: 0 }}>
        <circle cx={A0.x} cy={A0.y} r={8} fill="var(--panel)" stroke={color} strokeWidth={3} style={{ transition: 'stroke 200ms var(--ease-out)' }} />
      </g>

      {/* Figure */}
      <text
        ref={numRef}
        x={CX}
        y={CY + 2}
        textAnchor="middle"
        fontSize={44}
        fontWeight={600}
        letterSpacing="-0.02em"
        className="num font-mono"
        fill="var(--ink)"
      >
        —
      </text>
      <text x={CX} y={CY + 26} textAnchor="middle" fontSize={13} fill="var(--ink-3)">
        {mode === 'speed' ? 'Mbps' : 'ms'}
      </text>
      <text
        x={CX}
        y={CY + 76}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        letterSpacing="0.06em"
        fill={tone === 'ink' ? 'var(--ink-3)' : color}
        style={{ textTransform: 'uppercase' }}
      >
        {caption}
      </text>
    </svg>
  );
}
