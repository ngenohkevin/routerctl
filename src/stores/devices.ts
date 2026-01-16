import { create } from 'zustand';
import type { Device, SystemInfo, HealthStatus } from '@/types';
import { api } from '@/lib/api';

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
    } catch (error) {
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

  setBandwidthLimit: async (mac: string, upload: string, download: string) => {
    try {
      await api.setBandwidthLimit(mac, upload, download);
      set((state) => ({
        devices: state.devices.map((d) =>
          d.mac === mac
            ? { ...d, hasBWLimit: true, uploadLimit: upload, downloadLimit: download }
            : d
        ),
      }));
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
      set((state) => ({
        devices: state.devices.map((d) =>
          d.mac === mac
            ? { ...d, hasBWLimit: false, uploadLimit: undefined, downloadLimit: undefined }
            : d
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to remove bandwidth limit',
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
        eventSource = new EventSource('/api/events');

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
