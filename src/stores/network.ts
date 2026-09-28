import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { WANLink, CDNSteering, WANFailoverStatus, WiFiStatus } from '@/types';

/**
 * Uplinks, failover, CDN steering and Wi-Fi radios — one poll shared by every
 * component that shows them (the network path, the uplinks card, the Wi-Fi
 * card), instead of each component polling the agent on its own timer.
 */
interface NetworkState {
  links: WANLink[];
  failover: WANFailoverStatus | null;
  cdn: CDNSteering | null;
  wifi: WiFiStatus | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  links: [],
  failover: null,
  cdn: null,
  wifi: null,
  loaded: false,
  refresh: async () => {
    // Each call is independent: an older agent without /wifi or /wan/failover
    // must not blank the uplinks.
    const [links, failover, cdn, wifi] = await Promise.allSettled([
      api.getWanLinks(),
      api.getWanFailover(),
      api.getCdnSteering(),
      api.getWiFi(),
    ]);
    set((s) => ({
      links: links.status === 'fulfilled' ? links.value.links || [] : s.links,
      failover: failover.status === 'fulfilled' ? failover.value : s.failover,
      cdn: cdn.status === 'fulfilled' ? cdn.value : s.cdn,
      wifi: wifi.status === 'fulfilled' ? wifi.value : s.wifi,
      loaded: true,
    }));
  },
}));

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** Subscribe to the shared network poll (ref-counted; one timer total). */
export function useNetwork(intervalMs = 30000) {
  const state = useNetworkStore();
  useEffect(() => {
    subscribers++;
    if (subscribers === 1) {
      useNetworkStore.getState().refresh();
      timer = setInterval(() => useNetworkStore.getState().refresh(), intervalMs);
    }
    return () => {
      subscribers--;
      if (subscribers === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [intervalMs]);
  return state;
}
