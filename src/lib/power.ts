import type { LedTone } from '@/components/shell/led';
import type { UPSEvent, UPSPoint, UPSStatus } from '@/types';

/** "40s", "12 min", "1 h 07 m", "26 h 03 m". */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')} m`;
}

/** 24-hour clock in the viewer's time zone, e.g. "10:38". */
export function clock(t: string | number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "10:38" today, "Fri 10:38" on another day. */
export function dayClock(t: string, now: Date = new Date()): string {
  const d = new Date(t);
  return d.toDateString() === now.toDateString() ? clock(t) : `${d.toLocaleDateString([], { weekday: 'short' })} ${clock(t)}`;
}

export function secondsSince(iso: string, now: number = Date.now()): number {
  return (now - new Date(iso).getTime()) / 1000;
}

/** Colour means state: mains = link, on battery = amber, low = fault, unknown = off. */
export function powerTone(s: UPSStatus | null, failed: boolean): LedTone {
  if (failed || !s || !s.available) return 'off';
  if (s.state === 'low_battery') return 'fault';
  if (s.state === 'on_battery' || (s.alerts ?? []).length > 0) return 'amber';
  return 'link';
}

/** Edge tint for a panel that carries the UPS state. */
export function powerPanelTone(s: UPSStatus | null, failed: boolean): 'amber' | 'fault' | undefined {
  const t = powerTone(s, failed);
  return t === 'fault' ? 'fault' : t === 'amber' ? 'amber' : undefined;
}

const ALERT_TEXT: Record<string, string> = {
  replace_battery: 'The UPS says its battery needs replacing.',
  overload: 'The UPS is overloaded.',
  low_battery: 'The battery is low.',
};

export function alertText(a: string): string {
  return ALERT_TEXT[a] ?? a;
}

/** What the power is doing, in one line: "On battery since 10:38 · 23 min". */
export function powerHeadline(s: UPSStatus | null, failed: boolean, now: number = Date.now()): string {
  if (failed) return 'No data from the agent';
  if (!s) return 'Checking the UPS…';
  if (!s.available) return 'UPS not reporting';
  const since = s.onBatterySince
    ? ` since ${clock(s.onBatterySince)} · ${formatDuration(secondsSince(s.onBatterySince, now))}`
    : '';
  if (s.state === 'low_battery') return `Battery low${since}`;
  if (s.state === 'on_battery') return `On battery${since}`;
  if (s.testing) return 'Self-test running';
  return 'On mains';
}

/** The sentence the Overview headline leads with while the house runs on the UPS. */
export function batteryNote(s: UPSStatus | null, now: number = Date.now()): string | null {
  if (!s || !s.available) return null;
  if (s.state === 'low_battery') return 'UPS battery is low; everything will lose power soon.';
  if (s.state === 'on_battery') {
    const dur = s.onBatterySince ? ` for ${formatDuration(secondsSince(s.onBatterySince, now))}` : '';
    return `On UPS battery${dur}, battery ${s.battery.voltage.toFixed(1)} V.`;
  }
  return null;
}

/** One chart row. Null breaks the line: no data (agent, NUT or the Pi was down). */
export interface ChartRow {
  t: number;
  mains: number | null;
  battery: number | null;
  onBattery: boolean;
}

/** Minute points to chart rows, with a break wherever more than 2 minutes are missing. */
export function chartRows(series: UPSPoint[]): ChartRow[] {
  const rows: ChartRow[] = [];
  for (const p of series) {
    const t = new Date(p.t).getTime();
    const prev = rows[rows.length - 1];
    if (prev && t - prev.t > 2 * 60_000) {
      rows.push({ t: prev.t + 60_000, mains: null, battery: null, onBattery: false });
    }
    rows.push({ t, mains: Math.round(p.mains), battery: p.battery, onBattery: p.onBattery });
  }
  return rows;
}

/** The newest finished self-test at or after `after` (ms), if any. Events are newest first. */
export function testResultAfter(events: UPSEvent[] | null, after: number): UPSEvent | null {
  return (
    (events ?? []).find(
      (e) => e.kind === 'self_test' && e.detail === 'finished' && new Date(e.at).getTime() >= after
    ) ?? null
  );
}
