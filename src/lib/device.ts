import {
  Gamepad2,
  Laptop,
  Monitor,
  Printer,
  Router as RouterIcon,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  Watch,
  Camera,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { prettyBand } from '@/lib/utils';
import type { Device, IdentifiedBy } from '@/types';

/** Types the owner can pick when correcting a device. */
export const DEVICE_TYPES: { value: string; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'computer', label: 'Computer' },
  { value: 'watch', label: 'Watch' },
  { value: 'tv', label: 'TV' },
  { value: 'streaming', label: 'Streaming box' },
  { value: 'speaker', label: 'Speaker' },
  { value: 'gaming', label: 'Game console' },
  { value: 'printer', label: 'Printer' },
  { value: 'camera', label: 'Camera' },
  { value: 'smart-home', label: 'Smart home' },
  { value: 'iot', label: 'Other gadget' },
  { value: 'router', label: 'Network gear' },
];

export function typeLabel(type?: string): string | null {
  if (!type || type === 'unknown') return null;
  return DEVICE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export const IDENTIFIED_BY: Record<IdentifiedBy, string> = {
  you: 'Set by you',
  hostname: 'From the name it gives the router',
  mdns: 'From what it announces on the network',
  dhcp: 'From its operating system — a guess',
  vendor: 'From the maker of its network chip — a guess',
};

export const isOnline = (d: Device) => d.status === 'bound' || d.status === 'dynamic';

/**
 * A hostname as a person would write it: "Kevin-s-S26-Ultra" → "Kevin's S26
 * Ultra" (Android turns "Kevin's" into "Kevin-s"), "Family-Room-TV" →
 * "Family Room TV". Bare model codes ("SM-L715F") return null — the model
 * name says more.
 */
export function prettyHostname(hostname?: string): string | null {
  if (!hostname) return null;
  const h = hostname.replace(/\.(local|lan)$/i, '');
  if (/^[A-Z]{1,4}-[A-Z0-9]{3,}$/.test(h) || /^android[-_][0-9a-f]+$/i.test(h)) return null;
  return h.replace(/-s-/g, "'s ").replace(/[-_]+/g, ' ').trim() || null;
}

/** The name to show: the owner's name, then what the device calls itself. */
export function displayName(d: Device): string {
  if (d.name) return d.name;
  if (d.comment) return d.comment;
  if (d.wanSide) return 'Gateway';
  return prettyHostname(d.hostname) || d.deviceModel || typeLabel(d.deviceType) || d.vendor || d.hostname || d.ip || d.mac;
}

/** "Galaxy S26 Ultra · Android 16 · Samsung" — what it is, deduplicated. */
export function identityLine(d: Device): string {
  const name = displayName(d);
  const parts = [d.deviceModel || typeLabel(d.deviceType), d.os, d.vendor];
  const line = parts.filter((v, i, a) => v && a.indexOf(v) === i && v !== name).join(' · ');
  // Everything repeats the name ("Raspberry Pi" × 3): say what kind it is.
  return line || (typeLabel(d.deviceType) !== name ? typeLabel(d.deviceType) ?? '' : '');
}

/** Device glyph from its type — a drawn icon, not an emoji. */
export function glyphFor(d: Device): LucideIcon {
  if (d.wanSide) return RouterIcon;
  switch (d.deviceType) {
    case 'phone':
      return Smartphone;
    case 'tablet':
      return Tablet;
    case 'computer':
      return Laptop;
    case 'watch':
      return Watch;
    case 'tv':
    case 'streaming':
      return Tv;
    case 'speaker':
    case 'audio':
      return Speaker;
    case 'gaming':
      return Gamepad2;
    case 'printer':
      return Printer;
    case 'camera':
      return Camera;
    case 'smart-home':
    case 'iot':
      return Lightbulb;
    case 'router':
      return RouterIcon;
  }
  const t = `${d.deviceModel || ''} ${d.hostname || ''}`.toLowerCase();
  if (/(tv|roku|chromecast|fire ?stick|box)/.test(t)) return Tv;
  if (/(iphone|galaxy|pixel|android)/.test(t)) return Smartphone;
  if (/(macbook|laptop|desktop|imac|pc)/.test(t)) return Laptop;
  return Monitor;
}

/** Wi-Fi band or wired, in plain words. */
export function connectionLabel(d: Device): string {
  if (d.band) return prettyBand(d.band) ?? 'Wi-Fi';
  if (d.interface?.startsWith('wifi')) return 'Wi-Fi';
  return 'Wired';
}

/** The policy chips worth showing on a row. */
export function policyChips(d: Device): { label: string; tone: 'fault' | 'amber' | 'link' | 'air' }[] {
  const out: { label: string; tone: 'fault' | 'amber' | 'link' | 'air' }[] = [];
  if (d.isBlocked) out.push({ label: 'Blocked', tone: 'fault' });
  if (d.isExempt) out.push({ label: 'No limit', tone: 'link' });
  else if (d.hasBWLimit && !d.isDefaultLimit && d.policy?.mode === 'limit')
    out.push({ label: `Limit ${d.policy.download ?? d.downloadLimit}`, tone: 'amber' });
  if (d.priority && d.priority < 8) out.push({ label: 'Priority', tone: 'air' });
  return out;
}
