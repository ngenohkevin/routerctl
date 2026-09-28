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
  // Parsed numeric WiFi metrics (agent-side parsing of the raw strings)
  signalDbm?: number;
  txMbps?: number;
  rxMbps?: number;
  band?: string; // e.g. "5ghz-ax" (RouterOS v7 wifi package)
  // Per-client WiFi session counters (since association)
  wifiDownBytes?: number;
  wifiUpBytes?: number;
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
  // Priority (1=highest, 8=default/normal, 0=not set)
  priority: number;
  // Upstream equipment behind an uplink interface (ISP CPE) — hidden in the UI
  wanSide?: boolean;
}

export interface WANLink {
  interface: string; // "WAN", "WAN2"
  label?: string;    // "Faiba", "Vilcom"
  gateway?: string;
  address?: string;
  status: string;    // dhcp client status, "bound" = up
  linkRate?: string; // "1Gbps"
  primary: boolean;
  alive?: boolean;   // live probe ping through this uplink succeeded
  pingMs?: number;   // live probe RTT (ms)
  // From the latest speed test recorded for this uplink
  isp?: string;
  lastDownload?: number; // Mbps
  lastUpload?: number;   // Mbps
  lastPing?: number;     // ms
  lastTestAt?: string;   // RFC3339
  // Quality from the agent's failover loop (verified TLS handshakes through
  // this line). `alive` alone calls a line that answers in 2s with half its
  // packets lost "up"; `state` can say "severe". Older agents omit these.
  state?: LineState;
  lossPct?: number;
  medianMs?: number;
}

export type LineState = 'up' | 'degraded' | 'severe' | 'down';

// Wi-Fi radios (agent GET /wifi).
export interface WiFiRadio {
  interface: string; // "wifi1"
  ssid?: string;
  band: string; // "2.4 GHz" | "5 GHz"
  running: boolean;
  state?: string;
  channel?: string; // raw, e.g. "5180/ax/Ceee/I"
  frequency?: number;
  number?: number; // IEEE channel, e.g. 36
  widthMhz?: number;
  dfs: boolean; // radar-shared: radar forces the radio off, dropping clients
  indoor: boolean;
  txPower?: number;
  clients: number;
  skipDfs?: string;
  disabled: boolean;
}

export interface WiFiEvent {
  time: string; // RFC3339
  interface: string;
  band?: string;
  kind: 'radar' | 'channel' | 'down' | 'up';
  message: string;
}

export interface WiFiStatus {
  radios: WiFiRadio[];
  events: WiFiEvent[] | null;
  checkedAt?: string;
}

export interface LineQuality {
  interface: string;
  label?: string;
  primary: boolean;
  sent: number;
  ok: number;
  lossPct: number;
  medianMs?: number;
  state: LineState;
}

// Primary-line automatic failover. In auto, the agent moves the house off a
// SEVERELY degraded primary and back to `preferred` once it has been clean.
export interface WANFailoverStatus {
  mode: 'auto' | 'manual';
  preferred: string; // interface, e.g. "WAN"
  lines: LineQuality[];
  measuredAt?: string;
  lastSwitch?: string;
  lastReason?: string;
}

// Per-group CDN steering state (cloudflare / google), independently steered
export interface CDNGroupStatus {
  group: string; // "cloudflare" | "google"
  interface: string;
  label?: string;
  routes: number;
  active: number;
  mode: 'auto' | 'manual';
  health?: CFHealth[];
  lastAutoFlip?: string;
  lastAutoReason?: string;
}

export interface CDNSteering {
  groups: CDNGroupStatus[];
}

// Per-uplink CDN-group reachability, probed through that line.
// `state` distinguishes a congested line from a dead one: "degraded" means
// this group's probe timed out but the line still answered another pinned
// probe. `alive` remains the raw probe result (auto-steering uses it).
export interface CFHealth {
  interface: string;
  label?: string;
  alive: boolean;
  pingMs?: number;
  state?: 'up' | 'degraded' | 'down';
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
  isp?: string;     // egress ISP as seen from the internet (may be a transit provider)
  wan?: string;     // uplink interface the test ran through ("WAN", "WAN2")
  wanLabel?: string; // human name of that uplink ("Faiba", "Vilcom")
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

// Streaming Quality Test
export interface StreamingCDN {
  name: string;
  host: string;
  pingMs: number;
  reachable: boolean;
}

export interface StreamingQualityVerdict {
  quality: string;
  requiredMb: number;
  streamable: boolean;
  reason: string;
}

export interface StreamingTestResult {
  sustainedDownload: number;  // Mbps averaged over the whole window
  peakDownload: number;       // best 1s window in Mbps
  idleLatency: number;        // ms
  loadedLatency: number;      // ms
  worstLatency: number;       // ms (p95 under load)
  latencyRise: number;        // ms, loaded - idle
  bufferbloatGrade: string;   // A+ / A / B / C / D / F / —
  cdns: StreamingCDN[];
  qualities: StreamingQualityVerdict[];
  timestamp: string;
  durationSeconds: number;
  wan?: string;      // uplink interface the test ran through
  wanLabel?: string; // human name of that uplink ("Faiba", "Vilcom")
}

export interface LatencyResult {
  timestamp: string;
  targets: LatencyTarget[];
}
