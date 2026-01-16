import type {
  DevicesResponse,
  SystemResponse,
  BandwidthResponse,
  InterfacesResponse,
  HealthStatus,
  Device,
  ScheduledTask,
  DnsCacheEntry,
  PingResult,
  SpeedTestResult,
  TrafficStats,
  QueueStats,
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
    return fetchApi<DevicesResponse>('/devices');
  },

  async getDevice(mac: string): Promise<{ device: Device }> {
    return fetchApi<{ device: Device }>(`/devices/${encodeURIComponent(mac)}`);
  },

  async blockDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/block`, {
      method: 'POST',
    });
  },

  async unblockDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/unblock`, {
      method: 'POST',
    });
  },

  // Bandwidth
  async getBandwidth(): Promise<BandwidthResponse> {
    return fetchApi<BandwidthResponse>('/bandwidth');
  },

  async setBandwidthLimit(
    mac: string,
    upload: string,
    download: string
  ): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/bandwidth/${encodeURIComponent(mac)}/limit`, {
      method: 'POST',
      body: JSON.stringify({ upload, download }),
    });
  },

  async removeBandwidthLimit(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/bandwidth/${encodeURIComponent(mac)}/limit`, {
      method: 'DELETE',
    });
  },

  // System
  async getSystem(): Promise<SystemResponse> {
    return fetchApi<SystemResponse>('/system');
  },

  async getInterfaces(): Promise<InterfacesResponse> {
    return fetchApi<InterfacesResponse>('/interfaces');
  },

  // Device Management
  async setDeviceName(mac: string, name: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/name`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async disconnectDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/disconnect`, {
      method: 'POST',
    });
  },

  async wakeOnLan(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/wol`, {
      method: 'POST',
    });
  },

  async setDevicePriority(mac: string, priority: number): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/priority`, {
      method: 'POST',
      body: JSON.stringify({ priority }),
    });
  },

  async removeDevicePriority(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}/priority`, {
      method: 'DELETE',
    });
  },

  // System Control
  async rebootRouter(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/system/reboot', { method: 'POST' });
  },

  async getScheduledTasks(): Promise<{ tasks: ScheduledTask[] }> {
    return fetchApi<{ tasks: ScheduledTask[] }>('/scheduler');
  },

  async scheduleReboot(name: string, startTime: string, interval: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/scheduler/reboot', {
      method: 'POST',
      body: JSON.stringify({ name, startTime, interval }),
    });
  },

  async removeScheduledTask(name: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/scheduler/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },

  // DNS
  async getDnsCache(): Promise<{ entries: DnsCacheEntry[]; count: number }> {
    return fetchApi<{ entries: DnsCacheEntry[]; count: number }>('/dns/cache');
  },

  async flushDnsCache(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/dns/flush', { method: 'POST' });
  },

  // Network Tools
  async runPing(host: string, count: number = 4): Promise<{ result: PingResult }> {
    return fetchApi<{ result: PingResult }>('/tools/ping', {
      method: 'POST',
      body: JSON.stringify({ host, count }),
    });
  },

  async runSpeedTest(server: string, duration: number = 10): Promise<{ result: SpeedTestResult }> {
    return fetchApi<{ result: SpeedTestResult }>('/tools/speedtest', {
      method: 'POST',
      body: JSON.stringify({ server, duration }),
    });
  },

  // Traffic Statistics
  async getTrafficStats(): Promise<{ stats: TrafficStats[] }> {
    return fetchApi<{ stats: TrafficStats[] }>('/traffic');
  },

  async getQueueStats(): Promise<{ stats: QueueStats[] }> {
    return fetchApi<{ stats: QueueStats[] }>('/queues');
  },

  // SSE Events
  subscribeToEvents(
    onDevices: (devices: Device[]) => void,
    onSystem: (system: SystemResponse['system']) => void,
    onError: (error: Error) => void
  ): () => void {
    const apiKey = process.env.NEXT_PUBLIC_AGENT_API_KEY;
    const url = new URL(`${API_BASE}/events`, window.location.origin);

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
