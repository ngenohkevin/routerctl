import type {
  DevicesResponse,
  SystemResponse,
  BandwidthResponse,
  InterfacesResponse,
  HealthStatus,
  Device,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_AGENT_URL || '/api';

interface ApiOptions {
  headers?: Record<string, string>;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = process.env.NEXT_PUBLIC_AGENT_API_KEY;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Health
  async getHealth(): Promise<HealthStatus> {
    return fetchApi<HealthStatus>('/health');
  },

  // Devices
  async getDevices(): Promise<DevicesResponse> {
    return fetchApi<DevicesResponse>('/api/devices');
  },

  async getDevice(mac: string): Promise<{ device: Device }> {
    return fetchApi<{ device: Device }>(`/api/devices/${encodeURIComponent(mac)}`);
  },

  async blockDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/devices/${encodeURIComponent(mac)}/block`, {
      method: 'POST',
    });
  },

  async unblockDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/devices/${encodeURIComponent(mac)}/unblock`, {
      method: 'POST',
    });
  },

  // Bandwidth
  async getBandwidth(): Promise<BandwidthResponse> {
    return fetchApi<BandwidthResponse>('/api/bandwidth');
  },

  async setBandwidthLimit(
    mac: string,
    upload: string,
    download: string
  ): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/bandwidth/${encodeURIComponent(mac)}/limit`, {
      method: 'POST',
      body: JSON.stringify({ upload, download }),
    });
  },

  async removeBandwidthLimit(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/api/bandwidth/${encodeURIComponent(mac)}/limit`, {
      method: 'DELETE',
    });
  },

  // System
  async getSystem(): Promise<SystemResponse> {
    return fetchApi<SystemResponse>('/api/system');
  },

  async getInterfaces(): Promise<InterfacesResponse> {
    return fetchApi<InterfacesResponse>('/api/interfaces');
  },

  // SSE Events
  subscribeToEvents(
    onDevices: (devices: Device[]) => void,
    onSystem: (system: SystemResponse['system']) => void,
    onError: (error: Error) => void
  ): () => void {
    const apiKey = process.env.NEXT_PUBLIC_AGENT_API_KEY;
    const url = new URL(`${API_BASE}/api/events`, window.location.origin);

    const eventSource = new EventSource(url.toString());

    eventSource.addEventListener('devices', (event) => {
      try {
        const devices = JSON.parse(event.data);
        onDevices(devices);
      } catch (e) {
        console.error('Failed to parse devices event:', e);
      }
    });

    eventSource.addEventListener('system', (event) => {
      try {
        const system = JSON.parse(event.data);
        onSystem(system);
      } catch (e) {
        console.error('Failed to parse system event:', e);
      }
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const error = JSON.parse((event as MessageEvent).data);
        onError(new Error(error.error));
      } catch {
        onError(new Error('Connection error'));
      }
    });

    eventSource.onerror = () => {
      onError(new Error('EventSource connection failed'));
    };

    return () => {
      eventSource.close();
    };
  },
};
