/**
 * Shared speed-test maths: the gauge's fixed scale, display formatting and
 * the bufferbloat grade (same thresholds as the agent's streaming test).
 */

/**
 * Gauge ticks. The scale is fixed (not re-fitted to the last result) and
 * piecewise-linear between these ticks, so each step gets the same arc: a
 * 12 Mbps line and a 650 Mbps line both move the needle visibly, and the
 * scale never jumps between tests.
 */
export const GAUGE_TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000] as const;

const SEGMENTS = GAUGE_TICKS.length - 1;

/** Mbps → position along the gauge, 0..1. */
export function toScale(mbps: number): number {
  if (!(mbps > 0)) return 0;
  if (mbps >= GAUGE_TICKS[SEGMENTS]) return 1;
  let i = 0;
  while (mbps > GAUGE_TICKS[i + 1]) i++;
  const lo = GAUGE_TICKS[i];
  const hi = GAUGE_TICKS[i + 1];
  return (i + (mbps - lo) / (hi - lo)) / SEGMENTS;
}

/** Position along the gauge, 0..1 → Mbps (inverse of toScale). */
export function fromScale(s: number): number {
  const x = Math.min(Math.max(s, 0), 1) * SEGMENTS;
  const i = Math.min(Math.floor(x), SEGMENTS - 1);
  return GAUGE_TICKS[i] + (x - i) * (GAUGE_TICKS[i + 1] - GAUGE_TICKS[i]);
}

/** Speeds read at a glance: 3 significant figures, no trailing noise. */
export function formatMbps(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export function formatMs(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

/** How much latency rises when the line is saturated (agent: bufferbloatGrade). */
export function bufferbloatGrade(riseMs: number): Grade {
  if (riseMs < 5) return 'A+';
  if (riseMs < 30) return 'A';
  if (riseMs < 60) return 'B';
  if (riseMs < 200) return 'C';
  if (riseMs < 400) return 'D';
  return 'F';
}

/** Grade → state tone: good stays link, "fair" is amber, poor is a fault. */
export function gradeTone(grade: string): 'link' | 'amber' | 'fault' | 'ink' {
  if (grade === 'A+' || grade === 'A' || grade === 'B') return 'link';
  if (grade === 'C') return 'amber';
  if (grade === 'D' || grade === 'F') return 'fault';
  return 'ink';
}

export function gradeMeaning(grade: string): string {
  switch (grade) {
    case 'A+': return 'Latency barely moves under load';
    case 'A': return 'Small latency rise under load';
    case 'B': return 'Fine for streaming and most calls';
    case 'C': return 'Calls and live 4K may stutter while the line is busy';
    case 'D': return 'Calls and games struggle while someone downloads';
    case 'F': return 'The line becomes unusable while it is busy';
    default: return 'Not measured';
  }
}

/**
 * Bufferbloat from a speed test: the worse of the two loaded latencies,
 * less the idle ping. null when the test didn't measure it.
 */
export function loadedRise(ping: number | null | undefined, down?: number | null, up?: number | null): number | null {
  const loaded = Math.max(down ?? 0, up ?? 0);
  if (!(loaded > 0) || ping == null) return null;
  return Math.max(0, loaded - ping);
}
