import type {
  DevicesResponse,
  DeviceProfilePatch,
  SystemResponse,
  BandwidthResponse,
  InterfacesResponse,
  HealthStatus,
  Device,
  DefaultBandwidthConfig,
  ScheduledTask,
  DnsCacheEntry,
  DnsSettings,
  DHCPNetwork,
  PingResult,
  SpeedTestResult,
  TrafficStats,
  QueueStats,
  LogsResponse,
  DHCPLease,
  DHCPLeasesResponse,
  NetSpeedTestResult,
  SpeedTestServer,
  LatencyResult,
  StreamingTestResult,
  SpeedProgressEvent,
  StreamingProgressEvent,
  WANLink,
  CDNSteering,
  WANFailoverStatus,
  WiFiStatus,
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_AGENT_URL || '/api';
const AUTH_BASE = process.env.NEXT_PUBLIC_AGENT_URL?.replace('/api', '/auth') || '/api/auth';
const TOKEN_KEY = 'routerctl_token';
const EXPIRES_KEY = 'routerctl_token_expires'; // Unix seconds

// Helper to get token from localStorage (client-side only)
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Helper to set token in localStorage. expiresAt is the token's Unix-seconds
// expiry (from the login response) so the client can log out proactively
// instead of only discovering expiry via a failed request.
export function setToken(token: string, expiresAt?: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresAt) {
    localStorage.setItem(EXPIRES_KEY, String(expiresAt));
  }
}

// Helper to remove token from localStorage
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

// Build a same-origin login URL that remembers where the user was, so a
// mid-session expiry returns them to the page they were on after re-login.
// Guards against open-redirects: only same-origin ("/…", not "//…") paths.
function loginUrlWithReturn(): string {
  if (typeof window === 'undefined') return '/login';
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname === '/login' || here.startsWith('//')) return '/login';
  return `/login?next=${encodeURIComponent(here)}`;
}

// Check if user is authenticated. Returns false (and clears the stale token)
// once the known expiry has passed — a 30s skew avoids racing the server's
// own exp check. Tokens stored before expiry tracking existed are treated as
// valid; the 401 path still catches those.
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  const exp = Number(localStorage.getItem(EXPIRES_KEY));
  if (exp && Date.now() / 1000 > exp - 30) {
    removeToken();
    return false;
  }
  return true;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = loginUrlWithReturn();
    }
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  username: string;
}

/**
 * Read a test's server-sent event stream over fetch (EventSource can't send
 * the Authorization header). Events are parsed across chunk boundaries —
 * a `data:` line and its closing blank line often arrive in different reads —
 * and `:` heartbeat comments are ignored. If the stream ends without a
 * terminal event ("done"/"error") the caller gets an error event, so the UI
 * never sits on a test that silently died. The agent sends a heartbeat every
 * 10s, so 25s of silence means the path to it has stalled (the stream can
 * hang without erroring) — that is reported instead of freezing the page.
 * Returns an abort function.
 */
const STALL_MS = 25_000;

function streamTest<E extends { phase: string }>(
  path: string,
  onEvent: (event: E) => void,
  fail: (message: string) => E
): () => void {
  const controller = new AbortController();

  (async () => {
    let finished = false;
    const emit = (ev: E) => {
      if (finished) return;
      if (ev.phase === 'done' || ev.phase === 'error') finished = true;
      onEvent(ev);
    };

    let lastData = Date.now();
    const watchdog = setInterval(() => {
      // A backgrounded page may not be read from; don't count that time.
      if (document.hidden) {
        lastData = Date.now();
        return;
      }
      if (!finished && Date.now() - lastData > STALL_MS) {
        emit(fail('No updates from the agent for 25 seconds — the connection stalled'));
        controller.abort();
      }
    }, 5000);

    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(`${API_BASE}${path}`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        });
        // 409 = a previous test (often one abandoned by a page refresh) is
        // still releasing its lock. It clears within a couple of seconds
        // now that client disconnects propagate, so wait and retry once.
        if (response.status === 409 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }
        break;
      }

      if (response?.status === 401) {
        removeToken();
        window.location.href = loginUrlWithReturn();
        return;
      }
      if (!response || !response.ok || !response.body) {
        const err = (await response?.json().catch(() => null)) ?? {};
        emit(fail(err.error || `Test failed (HTTP ${response?.status ?? '—'})`));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let data: string[] = [];

      const takeLine = (raw: string) => {
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        if (line === '') {
          if (data.length) {
            try {
              emit(JSON.parse(data.join('\n')) as E);
            } catch {
              // Malformed event — skip it rather than end the test.
            }
            data = [];
          }
          return;
        }
        if (line.startsWith(':')) return; // heartbeat
        if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lastData = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(takeLine);
      }
      buffer += decoder.decode();
      if (buffer) takeLine(buffer);
      takeLine(''); // flush an event the server closed without a blank line

      if (!finished) emit(fail('The connection closed before the test finished'));
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !finished) {
        emit(fail('Connection to the agent was lost'));
      }
    } finally {
      clearInterval(watchdog);
    }
  })();

  return () => controller.abort();
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setToken(data.token, data.expiresAt);
    return data;
  },

  logout(): void {
    removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

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

  async updateDeviceProfile(mac: string, patch: DeviceProfilePatch): Promise<unknown> {
    return fetchApi(`/devices/${encodeURIComponent(mac)}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  /** Clear the "new device" flag on one device, or on all when mac is omitted. */
  async acknowledgeDevices(mac?: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(mac ? `/devices/${encodeURIComponent(mac)}/ack` : '/devices-ack', {
      method: 'POST',
    });
  },

  async forgetDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/devices/${encodeURIComponent(mac)}`, { method: 'DELETE' });
  },

  async reserveLease(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}/static`, { method: 'POST' });
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

  // Default Bandwidth
  async getDefaultBandwidth(): Promise<DefaultBandwidthConfig> {
    return fetchApi<DefaultBandwidthConfig>('/bandwidth/default');
  },

  async updateDefaultBandwidth(limit: string, enabled: boolean): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/bandwidth/default', {
      method: 'PUT',
      body: JSON.stringify({ limit, enabled }),
    });
  },

  async removeDefaultBandwidth(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/bandwidth/default', {
      method: 'DELETE',
    });
  },

  // Device Exemption
  async exemptDevice(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/bandwidth/${encodeURIComponent(mac)}/exempt`, {
      method: 'POST',
    });
  },

  async removeExemption(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/bandwidth/${encodeURIComponent(mac)}/exempt`, {
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

  async getDnsSettings(): Promise<{ settings: DnsSettings }> {
    return fetchApi<{ settings: DnsSettings }>('/dns/settings');
  },

  async setDnsSettings(
    servers: string[],
    allowRemoteRequests?: boolean
  ): Promise<{ message: string; servers: string[] }> {
    return fetchApi<{ message: string; servers: string[] }>('/dns/settings', {
      method: 'PUT',
      body: JSON.stringify({ servers, allowRemoteRequests }),
    });
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
    const url = new URL(`${API_BASE}/events`, window.location.origin);
    // EventSource can't set headers; the agent's middleware also accepts ?token=.
    const token = getToken();
    if (token) {
      url.searchParams.set('token', token);
    }

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

  // Router Logs
  async getLogs(limit: number = 100, topics?: string): Promise<LogsResponse> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (topics) {
      params.append('topics', topics);
    }
    return fetchApi<LogsResponse>(`/logs?${params.toString()}`);
  },

  async getLogTopics(): Promise<{ topics: string[] }> {
    return fetchApi<{ topics: string[] }>('/logs/topics');
  },

  // DHCP Lease Management
  async getDHCPLeases(staticOnly: boolean = false): Promise<DHCPLeasesResponse> {
    const params = staticOnly ? '?static=true' : '';
    return fetchApi<DHCPLeasesResponse>(`/dhcp/leases${params}`);
  },

  async getDHCPLease(mac: string): Promise<{ lease: DHCPLease }> {
    return fetchApi<{ lease: DHCPLease }>(`/dhcp/leases/${encodeURIComponent(mac)}`);
  },

  async makeLeaseStatic(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}/static`, {
      method: 'POST',
    });
  },

  async createStaticLease(data: {
    mac: string;
    address: string;
    hostname?: string;
    comment?: string;
    server?: string;
  }): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/dhcp/leases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLease(mac: string, data: { hostname?: string; comment?: string }): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLease(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}`, {
      method: 'DELETE',
    });
  },

  async enableLease(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}/enable`, {
      method: 'POST',
    });
  },

  async disableLease(mac: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/dhcp/leases/${encodeURIComponent(mac)}/disable`, {
      method: 'POST',
    });
  },

  // DHCP Network Configuration
  async getDhcpNetworks(): Promise<{ networks: DHCPNetwork[] }> {
    return fetchApi<{ networks: DHCPNetwork[] }>('/dhcp/networks');
  },

  async setDhcpNetworkDns(
    networkId: string,
    dnsServers: string[]
  ): Promise<{ message: string; dnsServers: string[] }> {
    return fetchApi<{ message: string; dnsServers: string[] }>(
      `/dhcp/networks/${encodeURIComponent(networkId)}/dns`,
      {
        method: 'PUT',
        body: JSON.stringify({ dnsServers }),
      }
    );
  },

  // Network Speed Test (runs from Pi) — SSE streaming via fetch ReadableStream
  async getWanLinks(): Promise<{ links: WANLink[] }> {
    return fetchApi<{ links: WANLink[] }>('/wan/links');
  },

  async setPrimaryWan(iface: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/wan/primary', {
      method: 'POST',
      body: JSON.stringify({ interface: iface }),
    });
  },

  async getWiFi(): Promise<WiFiStatus> {
    return fetchApi<WiFiStatus>('/wifi');
  },

  async getWanFailover(): Promise<WANFailoverStatus> {
    return fetchApi<WANFailoverStatus>('/wan/failover');
  },

  async setWanBalance(enabled: boolean): Promise<unknown> {
    return fetchApi('/wan/balance', { method: 'POST', body: JSON.stringify({ enabled }) });
  },

  async setWanFailover(req: { mode: 'auto' | 'manual' }): Promise<WANFailoverStatus> {
    return fetchApi<WANFailoverStatus>('/wan/failover', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getCdnSteering(): Promise<CDNSteering> {
    return fetchApi<CDNSteering>('/wan/cdn');
  },

  async setCdnSteering(iface: string, group?: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/wan/cdn', {
      method: 'POST',
      body: JSON.stringify({ interface: iface, group }),
    });
  },

  runNetSpeedTest(
    serverID: string | undefined,
    onProgress: (event: SpeedProgressEvent) => void,
    wan?: string
  ): () => void {
    const params = new URLSearchParams();
    if (serverID) params.set('serverID', serverID);
    if (wan) params.set('wan', wan);
    return streamTest<SpeedProgressEvent>(`/nettest/speedtest?${params}`, onProgress, (error) => ({
      phase: 'error',
      speed: 0,
      ping: 0,
      jitter: 0,
      server: {} as SpeedTestServer,
      error,
    }));
  },

  // Streaming Quality Test (runs from Pi against Cloudflare + CDN probes)
  runStreamingTest(onProgress: (event: StreamingProgressEvent) => void, wan?: string): () => void {
    const qs = wan ? `?wan=${encodeURIComponent(wan)}` : '';
    return streamTest<StreamingProgressEvent>(`/nettest/streaming${qs}`, onProgress, (error) => ({
      phase: 'error',
      error,
    }));
  },

  async runNetLatency(targets?: string[], count?: number): Promise<{ result: LatencyResult }> {
    return fetchApi<{ result: LatencyResult }>('/nettest/latency', {
      method: 'POST',
      body: JSON.stringify({ targets, count }),
    });
  },

  async listSpeedTestServers(): Promise<{ servers: SpeedTestServer[] }> {
    return fetchApi<{ servers: SpeedTestServer[] }>('/nettest/servers');
  },

  async getSpeedTestHistory(limit?: number): Promise<{ results: NetSpeedTestResult[]; count: number }> {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<{ results: NetSpeedTestResult[]; count: number }>(`/nettest/history${params}`);
  },

  async clearSpeedTestHistory(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/nettest/history', { method: 'DELETE' });
  },

  async getStreamingHistory(limit?: number): Promise<{ results: StreamingTestResult[]; count: number }> {
    const params = limit ? `?limit=${limit}` : '';
    return fetchApi<{ results: StreamingTestResult[]; count: number }>(`/nettest/streaming/history${params}`);
  },

  async clearStreamingHistory(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>('/nettest/streaming/history', { method: 'DELETE' });
  },
};
