import { create } from 'zustand';
import type { Device, SystemInfo, HealthStatus } from '@/types';
import { api } from '@/lib/api';

// Read the JWT directly (mirrors api.ts's getToken) so SSE can include
// ?token= in its URL — EventSource can't set Authorization headers.
function getJWT(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('routerctl_token');
}

interface DevicesState {
  devices: Device[];
  systemInfo: SystemInfo | null;
  health: HealthStatus | null;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  fetchDevices: () => Promise<void>;
  fetchSystemInfo: () => Promise<void>;
  fetchHealth: () => Promise<void>;
  blockDevice: (mac: string) => Promise<void>;
  unblockDevice: (mac: string) => Promise<void>;
  setBandwidthLimit: (mac: string, upload: string, download: string) => Promise<void>;
  removeBandwidthLimit: (mac: string) => Promise<void>;
  exemptDevice: (mac: string) => Promise<void>;
  removeExemption: (mac: string) => Promise<void>;
  disconnectDevice: (mac: string) => Promise<void>;
  setDeviceName: (mac: string, name: string) => Promise<void>;
  setDevicePriority: (mac: string, priority: number) => Promise<void>;
  removeDevicePriority: (mac: string) => Promise<void>;
  wakeOnLan: (mac: string) => Promise<void>;
  setDevices: (devices: Device[]) => void;
  setSystemInfo: (systemInfo: SystemInfo) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  subscribeToEvents: () => () => void;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  devices: [],
  systemInfo: null,
  health: null,
  isLoading: false,
  isConnected: false,
  error: null,
  lastUpdated: null,

  fetchDevices: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getDevices();
      set({
        devices: response.devices,
        isLoading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch devices',
        isLoading: false,
      });
    }
  },

  fetchSystemInfo: async () => {
    try {
      const response = await api.getSystem();
      set({ systemInfo: response.system });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch system info',
      });
    }
  },

  fetchHealth: async () => {
    try {
      const response = await api.getHealth();
      set({ health: response });
    } catch {
      set({
        health: {
          status: 'offline',
          routerConnected: false,
          timestamp: new Date().toISOString(),
        },
      });
    }
  },

  blockDevice: async (mac: string) => {
    try {
      await api.blockDevice(mac);
      // Update local state
      set((state) => ({
        devices: state.devices.map((d) =>
          d.mac === mac ? { ...d, isBlocked: true } : d
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to block device',
      });
      throw error;
    }
  },

  unblockDevice: async (mac: string) => {
    try {
      await api.unblockDevice(mac);
      set((state) => ({
        devices: state.devices.map((d) =>
          d.mac === mac ? { ...d, isBlocked: false } : d
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to unblock device',
      });
      throw error;
    }
  },

  // Optimistic boolean flips for limit/exempt/priority transitions are too
  // entangled with server-side reconciliation (default-bandwidth on/off,
  // mutual exclusion between exempt and limit, MAC randomization) to model
  // correctly client-side. After the mutation lands, refetch authoritative
  // state — the brief refetch latency is far less confusing than a UI that
  // lies for two seconds and then snaps to the truth on the next SSE tick.
  setBandwidthLimit: async (mac: string, upload: string, download: string) => {
    try {
      await api.setBandwidthLimit(mac, upload, download);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set bandwidth limit',
      });
      throw error;
    }
  },

  removeBandwidthLimit: async (mac: string) => {
    try {
      await api.removeBandwidthLimit(mac);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove bandwidth limit',
      });
      throw error;
    }
  },

  exemptDevice: async (mac: string) => {
    try {
      await api.exemptDevice(mac);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to exempt device',
      });
      throw error;
    }
  },

  removeExemption: async (mac: string) => {
    try {
      await api.removeExemption(mac);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove exemption',
      });
      throw error;
    }
  },

  disconnectDevice: async (mac: string) => {
    try {
      await api.disconnectDevice(mac);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to disconnect device',
      });
      throw error;
    }
  },

  setDeviceName: async (mac: string, name: string) => {
    try {
      await api.setDeviceName(mac, name);
      // Optimistic patch for instant feedback, then refetch — the agent
      // stores the name as the DHCP lease comment and may normalize it.
      set((state) => ({
        devices: state.devices.map((d) =>
          d.mac === mac ? { ...d, comment: name } : d
        ),
      }));
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set device name',
      });
      throw error;
    }
  },

  setDevicePriority: async (mac: string, priority: number) => {
    try {
      await api.setDevicePriority(mac, priority);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set device priority',
      });
      throw error;
    }
  },

  removeDevicePriority: async (mac: string) => {
    try {
      await api.removeDevicePriority(mac);
      await get().fetchDevices();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove device priority',
      });
      throw error;
    }
  },

  wakeOnLan: async (mac: string) => {
    try {
      await api.wakeOnLan(mac);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send Wake on LAN',
      });
      throw error;
    }
  },

  setDevices: (devices: Device[]) => {
    set({ devices, lastUpdated: new Date() });
  },

  setSystemInfo: (systemInfo: SystemInfo) => {
    set({ systemInfo });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  },

  subscribeToEvents: () => {
    const { fetchDevices, fetchSystemInfo, setConnected, setError } = get();
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let usePolling = false;

    const startPolling = () => {
      if (pollInterval) return;
      usePolling = true;
      setConnected(true);
      console.log('[SSE] Falling back to polling (5s interval)');

      // Poll every 5 seconds
      pollInterval = setInterval(() => {
        fetchDevices();
        fetchSystemInfo();
      }, 5000);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }

      try {
        // EventSource can't send Authorization headers; the agent's auth
        // middleware also accepts ?token=, which the proxy forwards verbatim.
        const token = getJWT();
        const url = token ? `/api/events?token=${encodeURIComponent(token)}` : '/api/events';
        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          setConnected(true);
          setError(null);
          stopPolling();
          usePolling = false;
          console.log('[SSE] Connected');
        };

        eventSource.addEventListener('devices', (event) => {
          try {
            const devices = JSON.parse(event.data);
            get().setDevices(devices);
          } catch (e) {
            console.error('Failed to parse devices event:', e);
          }
        });

        eventSource.addEventListener('system', (event) => {
          try {
            const system = JSON.parse(event.data);
            get().setSystemInfo(system);
          } catch (e) {
            console.error('Failed to parse system event:', e);
          }
        });

        eventSource.onerror = () => {
          console.log('[SSE] Connection error, using polling');
          setConnected(false);
          eventSource?.close();
          eventSource = null;

          // Fall back to polling
          if (!usePolling) {
            startPolling();
          }

          // Try to reconnect SSE after 30 seconds
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            if (usePolling) {
              console.log('[SSE] Attempting to reconnect...');
              connectSSE();
            }
          }, 30000);
        };
      } catch (e) {
        console.error('[SSE] Failed to create EventSource:', e);
        startPolling();
      }
    };

    // Start with SSE, fall back to polling if it fails
    connectSSE();

    // Return cleanup function
    return () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      stopPolling();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      setConnected(false);
    };
  },
}));
