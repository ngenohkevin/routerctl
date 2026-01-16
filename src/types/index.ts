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
  target: string;
  rate: string;
  bytesIn: string;
  bytesOut: string;
  packetsIn: string;
  packetsOut: string;
  queuedBytes: string;
  queuedPackets: string;
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
  bytesIn: string;
  bytesOut: string;
  packetsIn: string;
  packetsOut: string;
  dropped: string;
}
