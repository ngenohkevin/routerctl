import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { UPSStatus } from '@/types';

/**
 * The UPS state — one poll shared by the Overview card, the headline and the
 * Power page, instead of each polling the agent on its own timer.
 */
interface UPSStoreState {
  status: UPSStatus | null;
  loaded: boolean;
  /** The last poll failed: agent unreachable, or too old to know /ups. */
  failed: boolean;
  refresh: () => Promise<void>;
  setStatus: (s: UPSStatus) => void;
}

export const useUpsStore = create<UPSStoreState>((set) => ({
  status: null,
  loaded: false,
  failed: false,
  refresh: async () => {
    try {
      const status = await api.getUps();
      set({ status, loaded: true, failed: false });
    } catch {
      set({ loaded: true, failed: true });
    }
  },
  setStatus: (status) => set({ status, loaded: true, failed: false }),
}));

let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** Subscribe to the shared UPS poll (ref-counted; one timer total). */
export function useUps(intervalMs = 10000) {
  const state = useUpsStore();
  useEffect(() => {
    subscribers++;
    if (subscribers === 1) {
      useUpsStore.getState().refresh();
      timer = setInterval(() => useUpsStore.getState().refresh(), intervalMs);
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
