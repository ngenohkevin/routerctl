import type { LedTone } from '@/components/shell/led';
import type { PowerCut, PowerCutView, PowerEvent, PowerStatus } from '@/types';
import { clock, formatDuration, secondsSince } from '@/lib/power';

/** Problems that stop the switch-off or the detection from working. */
const BLOCKING = new Set(['tv_unreachable', 'plugs_blind', 'auth_rejected', 'mains_stuck_off']);

export function minutesLeft(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}

/** Colour means state: link = mains on, amber = a cut, a test or a problem, fault = a problem that breaks the switch-off, off = can't tell. */
export function homePowerTone(s: PowerStatus | null, failed: boolean): LedTone {
  if (failed || !s) return 'off';
  const problems = s.problems ?? [];
  if (problems.some((p) => BLOCKING.has(p.code))) return 'fault';
  if (s.cut || s.test || problems.length > 0) return 'amber';
  if (s.mains === 'unknown') return 'off';
  return 'link';
}

export function homePowerPanelTone(s: PowerStatus | null, failed: boolean): 'amber' | 'fault' | undefined {
  const t = homePowerTone(s, failed);
  return t === 'fault' ? 'fault' : t === 'amber' ? 'amber' : undefined;
}

/** What the power is doing, in one line. */
export function homePowerHeadline(s: PowerStatus | null, failed: boolean, now: number = Date.now()): string {
  if (failed) return 'No data from the agent';
  if (!s) return 'Checking the power…';
  if (s.cut && !s.cut.test) return `Power cut for ${formatDuration(secondsSince(s.cut.start, now))}`;
  if (s.test) return `Test cut until ${clock(s.test.ends)}`;
  if (s.mains === 'unknown') return s.reason ?? 'Can’t tell: the plugs aren’t answering';
  return 'Mains on';
}

/** What happens to the TV group in this cut. */
export function tvLine(cut: PowerCutView, now: number = Date.now()): string {
  switch (cut.mode) {
    case 'countdown':
      return cut.switchOffAt
        ? `TV group switches off in ${minutesLeft(cut.switchOffAt, now)} min (${clock(cut.switchOffAt)})`
        : 'TV group is switching off';
    case 'until_power':
      return 'TV group stays on until power returns';
    default:
      return cut.tvOffByPi && cut.tvOffAt ? `TV group off since ${clock(cut.tvOffAt)}` : 'TV group was already off';
  }
}

/** The Overview headline's note during a real cut (like batteryNote for the UPS). */
export function homePowerNote(s: PowerStatus | null, now: number = Date.now()): string | null {
  if (!s?.cut || s.cut.test) return null;
  return `Power cut for ${formatDuration(secondsSince(s.cut.start, now))}. ${tvLine(s.cut, now)}.`;
}

export const extensionLabel: Record<string, string> = {
  plus10: '+10 min',
  plus30: '+30 min',
  until_power: 'until power returns',
  off_now: 'off now',
};

export function signalText(rssi: number): string {
  if (rssi >= -60) return 'strong';
  if (rssi >= -70) return 'fair';
  return 'weak';
}

/** The detail lines under a cut in the list. */
export function cutDetail(c: PowerCut): string[] {
  const out: string[] = [];
  if (c.startApprox) out.push('Start is approximate: it began while the Pi couldn’t see the plugs.');
  if (c.tvOffAtStart) out.push('TV group was already off.');
  for (const e of c.extensions ?? []) out.push(`${clock(e.at)}: ${extensionLabel[e.kind] ?? e.kind}.`);
  if (c.tvOffAt) out.push(`TV group off at ${clock(c.tvOffAt)}.`);
  for (const o of c.overrides ?? []) out.push(`${clock(o)}: TV group turned back on.`);
  if (c.tvRestored) out.push('TV group switched back on when power returned.');
  if (c.ranOut) out.push('The Pi lost power: the battery ran out before mains came back.');
  if (c.source === 'hikvision' && c.lowestBatteryV) {
    out.push(`Hikvision UPS: battery down to ${c.lowestBatteryV.toFixed(1)} V, peak load ${c.peakLoad ?? 0}%.`);
  }
  return out;
}

const SWITCHED: Record<string, string> = { tv_off: 'TV group off', tv_on: 'TV group on', mains_on: 'Mains on', mains_off: 'Mains off' };
const TEST: Record<string, string> = {
  started: 'Test cut started',
  stopped: 'Test cut stopped',
  ended: 'Test cut finished',
  taken_over: 'Test cut ended by a real power cut',
};
const PLUG: Record<string, string> = { restarted: 'Plug restart', firmware: 'Firmware changed', reblocked: 'Router block re-added' };

export function eventText(e: PowerEvent): string {
  switch (e.kind) {
    case 'switch':
      return `${SWITCHED[e.detail] ?? e.detail}${e.note ? ` (${e.note})` : ''}${e.ok ? '' : ', failed'}`;
    case 'test':
      return TEST[e.detail] ?? `Test: ${e.detail}`;
    case 'settings':
      return `Settings changed: ${e.note ?? ''}`.trim();
    case 'plug':
      return `${PLUG[e.detail] ?? e.detail}${e.note ? `: ${e.note}` : ''}${e.ok ? '' : ', failed'}`;
    default:
      return e.note ?? e.detail;
  }
}
