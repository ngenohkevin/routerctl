export interface Device {
  mac: string;
  ip: string;
  hostname: string;
  interface: string;
  status: string;
  lastSeen: string;
  isBlocked: boolean;
  hasBWLimit: boolean;
  uploadLimit?: string;
  downloadLimit?: string;
  comment?: string;
  // Connection time
  uptime?: string;
  uptimeSeconds: number;
  // WiFi specific
  signalStrength?: string;
  txRate?: string;
  rxRate?: string;
  // Vendor identification
  vendor?: string;
  deviceType?: string;
  deviceIcon?: string;
  deviceModel?: string;
  // Bandwidth usage (from queue stats)
  bytesIn?: string;
  bytesOut?: string;
  // Real-time bandwidth rate (bytes/sec)
  rateIn?: string;
  rateOut?: string;
  // Default bandwidth tracking
  isDefaultLimit: boolean;
  isExempt: boolean;
}

export interface SystemInfo {
  platform: string;
  boardName: string;
  version: string;
  uptime: string;
  cpuLoad: string;
  freeMemory: string;
  totalMemory: string;
  freeHdd: string;
  totalHdd: string;
  architecture: string;
  buildTime: string;
  factorySoftware: string;
}

export interface Identity {
  name: string;
}

export interface InterfaceInfo {
  id: string;
  name: string;
  type: string;
  mac: string;
  mtu: string;
  running: boolean;
  disabled: boolean;
  txBytes: string;
  rxBytes: string;
  txRate?: string;
  rxRate?: string;
}

export interface BandwidthLimit {
  id: string;
  name: string;
  target: string;
  upload: string;
  download: string;
  disabled: boolean;
}

export interface BandwidthStats {
  name: string;
  target: string;
  rate: string;
  bytesIn: string;
  bytesOut: string;
  packetsIn: string;
  packetsOut: string;
  queuedBytes: string;
  queuedPackets: string;
  comment?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  routerConnected: boolean;
  timestamp: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  cached?: boolean;
}

export interface DevicesResponse {
  devices: Device[];
  cached: boolean;
}

export interface SystemResponse {
  system: SystemInfo;
  identity: Identity;
}

export interface BandwidthResponse {
  limits: Record<string, BandwidthLimit>;
  stats: BandwidthStats[];
}

export interface DefaultBandwidthConfig {
  enabled: boolean;
  limit: string;
}

export interface InterfacesResponse {
  interfaces: InterfaceInfo[];
}

// New types for additional features
export interface ScheduledTask {
  id: string;
  name: string;
  startTime: string;
  interval: string;
  onEvent: string;
  nextRun: string;
  runCount: string;
  rebootCount: number;
  comment?: string;
  disabled: boolean;
}

export interface DnsCacheEntry {
  name: string;
  type: string;
  data: string;
  ttl: string;
  static: boolean;
}

export interface DnsSettings {
  servers: string[];
  allowRemoteRequests: boolean;
  cacheSize: string;
  cacheMaxTTL: string;
  maxConcurrentQueries: string;
}

export interface DHCPNetwork {
  id: string;
  address: string;
  gateway: string;
  dnsServers: string[];
  domain?: string;
  comment?: string;
}

export interface PingResult {
  host: string;
  sent: number;
  received: number;
  packetLoss: string;
  minRtt: string;
  avgRtt: string;
  maxRtt: string;
}

export interface SpeedTestResult {
  status: string;
  duration: string;
  txCurrent: string;
  rxCurrent: string;
  txTotalAvg: string;
  rxTotalAvg: string;
  lostPackets: string;
}

export interface TrafficStats {
  interface: string;
  rxBytes: string;
  txBytes: string;
  rxPackets: string;
  txPackets: string;
  rxRate?: string;
  txRate?: string;
}

export interface QueueStats {
  name: string;
  target: string;
  rate: string;
  rateIn: string;
  rateOut: string;
  bytesIn: string;
  bytesOut: string;
  packetsIn: string;
  packetsOut: string;
  dropped: string;
}

// Router Logs
export interface LogEntry {
  id: string;
  time: string;
  topics: string;
  message: string;
}

export interface LogsResponse {
  logs: LogEntry[];
  count: number;
}

// DHCP Leases
export interface DHCPLease {
  id: string;
  address: string;
  mac: string;
  hostname: string;
  comment: string;
  server: string;
  dynamic: boolean;
  disabled: boolean;
  status: string;
  lastSeen?: string;
}

export interface DHCPLeasesResponse {
  leases: DHCPLease[];
  count: number;
}

// Network Speed Test (runs from Pi, not router)
export interface NetSpeedTestResult {
  id: string;
  timestamp: string;
  server: SpeedTestServer;
  download: number; // Mbps
  upload: number;   // Mbps
  ping: number;     // ms
  jitter: number;   // ms
}

export interface SpeedTestServer {
  id: string;
  name: string;
  host: string;
  country: string;
  sponsor: string;
  distance: number; // km
  latency: number;  // ms
}

export interface LatencyTarget {
  name: string;
  host: string;
  ping: number;   // ms
  jitter: number; // ms
  loss: number;   // percentage
  min: number;    // ms
  max: number;    // ms
  error?: string;
}

export interface LatencyResult {
  timestamp: string;
  targets: LatencyTarget[];
}
