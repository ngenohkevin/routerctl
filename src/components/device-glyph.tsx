import { createElement } from 'react';
import { glyphFor } from '@/lib/device';
import type { Device } from '@/types';

/** The drawn icon for a device's type. */
export function DeviceGlyph({ device, className }: { device: Device; className?: string }) {
  return createElement(glyphFor(device), { className, 'aria-hidden': true });
}
