import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/lib/api';
import type { PowerStatus } from '@/types';

/**
 * Home power — one poll of /api/power shared by the Overview, the headline,
 * the Devices page and the Power page.
 */
interface PowerStoreState {
  status: PowerStatus | null;
  loaded: boolean;
  /** The last poll failed: the agent is unreachable, or too old to have /power. */
  failed: boolean;
  /** The agent has reported the plug monitor at least once in this session. */
  configuredOnce: boolean;
  refresh: () => Promise<void>;
  setStatus: (s: PowerStatus) => void;
}

export const usePowerStore = create<PowerStoreState>((set) => ({
  status: null,
  loaded: false,
  failed: false,
  configuredOnce: false,
  refresh: async () => {
    try {
      const status = await api.getPower();
      set((st) => ({ status, loaded: true, failed: false, configuredOnce: st.configuredOnce || status.configured }));
    } catch {
      set({ loaded: true, failed: true });
    }
  },
  setStatus: (status) => set((st) => ({ status, loaded: true, failed: false, configuredOnce: st.configuredOnce || status.configured })),
}));

// One timer for every subscriber, at the fastest interval any of them asked
// for: the Overview's device cards ask for 30 s, but the Power card and the
// headline on the same page need 5 s during a cut.
const wanted: number[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let timerEvery = 0;

function retime() {
  const every = wanted.length > 0 ? Math.min(...wanted) : 0;
  if (every === timerEvery) return;
  if (timer) clearInterval(timer);
  timer = every ? setInterval(() => usePowerStore.getState().refresh(), every) : null;
  timerEvery = every;
}

/** Subscribe to the shared power poll (ref-counted; one timer). */
export function usePower(intervalMs = 5000) {
  const state = usePowerStore();
  useEffect(() => {
    if (wanted.length === 0) usePowerStore.getState().refresh();
    wanted.push(intervalMs);
    retime();
    return () => {
      wanted.splice(wanted.indexOf(intervalMs), 1);
      retime();
    };
  }, [intervalMs]);
  return state;
}

/**
 * Which Power view to show: 'plugs' once the agent has reported the plug
 * monitor (and stays there if the agent drops out for a moment), 'ups' when
 * it says it isn't configured or has no /power route (an older agent),
 * null while the first poll loads.
 */
export function powerMode(s: Pick<PowerStoreState, 'status' | 'loaded' | 'configuredOnce'>): 'plugs' | 'ups' | null {
  if (s.configuredOnce || s.status?.configured) return 'plugs';
  return s.loaded ? 'ups' : null;
}
