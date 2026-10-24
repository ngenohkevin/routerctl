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

  // Identification detail
  os?: string;            // from the DHCP vendor class ("Android 14")
  identifiedBy?: IdentifiedBy;
  randomMac?: boolean;    // private/randomized address: the MAC names no maker
  reserved?: boolean;     // the IP is a static lease on the router
  detectedType?: string;  // automatic type, when the owner overrode it
  detectedModel?: string;

  // From the agent's device registry
  name?: string;          // the owner's name for it
  owner?: string;
  notes?: string;
  firstSeen?: string;
  isNew?: boolean;        // joined since the list was last reviewed
  policy?: DevicePolicy;  // follows the device's MAC across IP changes
  remembered?: boolean;   // known only from the registry (left the network)
}

export type IdentifiedBy = 'you' | 'hostname' | 'mdns' | 'dhcp' | 'vendor';

export interface DevicePolicy {
  mode?: 'exempt' | 'limit';
  upload?: string;
  download?: string;
  priority?: number;
  blocked?: boolean;
}

export interface DeviceProfilePatch {
  name?: string;
  type?: string;
  model?: string;
  owner?: string;
  notes?: string;
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

// One line as the selector sees it: this cycle, plus the 5-minute window
// and the latest capacity reading.
export interface LineStatus extends LineQuality {
  windowMs?: number;
  windowLossPct: number;
  capacityMbps?: number;
  capacityAt?: string;
  capacitySource?: 'probe' | 'speed test' | 'streaming test';
  /** Two bad cycles in three minutes: everything leaves it, nothing goes onto it. */
  unstable?: boolean;
  unstableSince?: string;
  /** While unstable: when it is used again, if it stays clean until then. */
  backAfter?: string;
  /** Back in use; streaming routes and the house move onto it for speed again from then. */
  settlesAt?: string;
}

// Primary-line selection. In auto, the agent puts the house on whichever line
// measures better (no preferred line); manual pins the current one.
export interface WANFailoverStatus {
  mode: 'auto' | 'manual';
  lines: LineStatus[];
  measuredAt?: string;
  lastSwitch?: string;
  lastReason?: string;
  /** Another line is winning; it takes over once it has won for `required` s. */
  pending?: { interface: string; reason: string; seconds: number; required: number };
  /** Per-line probe addresses missing from the Pi: measurements paused. */
  probeSourcesMissing?: string[];
  /** Per-connection load balancing: new TCP connections split across lines. */
  balance?: {
    enabled: boolean;
    shares?: Record<string, number>; // interface -> buckets
    buckets: number;
    reason?: string;
    error?: string;
  };
  /** Destinations routed by reachability (e.g. Telegram). */
  reach?: {
    group: string;
    label: string;
    reachable: Record<string, number>; // interface -> % of handshakes that completed
    via?: string;
    reason?: string;
    checkedAt?: string;
  }[];
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
  // Latency while the line is saturated (bufferbloat); absent on older results.
  latencyDown?: number; // ms
  latencyUp?: number;   // ms
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
  line?: string;  // uplink a pinned probe address always leaves by; absent = current route
  ping: number;   // ms
  jitter: number; // ms
  loss: number;   // percentage
  min: number;    // ms
  max: number;    // ms
  error?: string;
}

// Streaming Quality Test
/** A website handshake — only in streaming results saved before 2026-10-10. */
export interface StreamingCDN {
  name: string;
  host: string;
  pingMs: number;
  reachable: boolean;
}

/** One Netflix server fast.com assigned to the line under test. */
export interface NetflixServer {
  host: string;
  city: string;
  country: string;
  connectMs: number; // TCP handshake; 0 = unreachable
  mbps: number;      // steady download over 4 streams
  error?: string;
}

export interface NetflixResult {
  servers: NetflixServer[];
  bestMbps: number;  // the fastest server: what a Netflix player can get
  error?: string;    // why Netflix couldn't be measured (verdicts then use Cloudflare)
}

/** The Google cache YouTube assigns the line's IP. */
export interface YouTubeCache {
  node?: string;     // e.g. "jtlinternet-nbo2"
  location?: string; // city
  inIsp: boolean;    // a Google Global Cache inside the ISP's network
  error?: string;
}

export interface StreamingQualityVerdict {
  quality: string;
  requiredMb: number;
  streamable: boolean;
  reason: string;
}

export interface StreamingTestResult {
  sustainedDownload: number;  // Mbps from Cloudflare, steady after the grace period
  peakDownload: number;       // best 1s window in Mbps (Cloudflare)
  idleLatency: number;        // ms
  loadedLatency: number;      // ms
  worstLatency: number;       // ms (p95 under load)
  latencyRise: number;        // ms, loaded - idle
  bufferbloatGrade: string;   // A+ / A / B / C / D / F / —
  netflix?: NetflixResult;
  youtube?: YouTubeCache;
  cdns?: StreamingCDN[];      // website handshakes — older results only
  qualities: StreamingQualityVerdict[];
  verdictSource?: 'netflix' | 'cloudflare'; // whose speed the verdicts judge
  timestamp: string;
  durationSeconds: number;
  wan?: string;      // uplink interface the test ran through
  wanLabel?: string; // human name of that uplink ("Faiba", "Vilcom")
}

/** One event from the speed test stream (/nettest/speedtest). */
export interface SpeedProgressEvent {
  phase: 'setup' | 'ping' | 'download' | 'upload' | 'done' | 'error';
  speed: number;      // live Mbps over the last second; the phase result when `final`
  progress?: number;  // 0..1 through the current phase
  final?: boolean;    // closes a phase with its measured value
  latency?: number;   // live latency under load (ms); the phase median when `final`
  ping: number;       // ms — running median during ping, then the result
  jitter: number;     // ms
  server: SpeedTestServer;
  isp?: string;
  message?: string;   // "setup" stage description
  result?: NetSpeedTestResult;
  error?: string;
}

/** One event from the streaming test stream (/nettest/streaming). */
export interface StreamingProgressEvent {
  phase: 'services' | 'netflix' | 'idle' | 'download' | 'bufferbloat' | 'done' | 'error';
  speed?: number;     // live Mbps (netflix, download)
  progress?: number;  // 0..1 through the netflix or download phase
  latency?: number;
  message?: string;   // netflix: "Netflix · Nairobi, KE"
  result?: StreamingTestResult;
  error?: string;
}

export interface LatencyResult {
  timestamp: string;
  targets: LatencyTarget[];
}

// UPS (NUT on the Pi) — /api/ups*
export type UPSState = 'online' | 'on_battery' | 'low_battery' | 'unavailable';
export type UPSBatteryState = 'discharging' | 'charging' | 'charged' | ''; // '' = not known yet

export interface UPSOutage {
  start: string;
  end: string | null; // null while the cut is going on
  durationSec: number;
  lowestBatteryV: number;
  peakLoad: number;
  ranOut: boolean; // the battery emptied before mains came back
  ranOutAt: string | null;
  lastOnBattery?: string;
}

export interface UPSEvent {
  at: string;
  kind: 'beeper' | 'self_test';
  detail: 'toggled' | 'started' | 'stopped' | 'finished' | 'muted' | 'unmuted'; // muted/unmuted: older entries
  ok: boolean;
  note?: string;
}

export interface UPSStatus {
  available: boolean;
  reason?: string;
  state: UPSState;
  testing: boolean;
  alerts: string[] | null; // 'replace_battery' | 'overload' | 'low_battery'
  flags: string[] | null;
  mains: { voltage: number; frequency: number };
  outputVoltage: number;
  battery: { voltage: number; charge: number; chargeEstimated: boolean; state?: UPSBatteryState }; // older agents omit state
  load: number;
  beeper: 'enabled' | 'disabled' | '';
  onBatterySince: string | null;
  lastOutage: UPSOutage | null;
  controls: { configured: boolean };
  updatedAt: string | null;
}

export interface UPSPoint {
  t: string;
  mains: number;
  battery: number;
  onBattery: boolean;
}

export interface UPSHistory {
  series: UPSPoint[] | null;
  outages: UPSOutage[] | null;
  events: UPSEvent[] | null;
  since: string | null;
}

// Home power (two Tapo plugs; the Delta in phase 2) — /api/power*
export type PowerVerdict = 'on' | 'off' | 'unknown';
export type PowerCutMode = 'countdown' | 'until_power' | 'off';
export type PowerExtensionKind = 'plus10' | 'plus30' | 'until_power' | 'off_now';

export interface PowerExtension {
  at: string;
  kind: PowerExtensionKind;
}

export interface PowerCutView {
  start: string;
  startApprox: boolean;
  test: boolean;
  mode: PowerCutMode;
  switchOffAt: string | null;
  tvOffAt: string | null;
  tvOffByPi: boolean;
  cutoffMinutes: number;
  extensions: PowerExtension[] | null;
  mainsBackSince: string | null;
  cause?: PowerCause;
  /** The 5-minute warning went for this switch-off time (older agents omit it). */
  warned?: boolean;
}

/** Why the Delta lost its supply: Mains silent (blackout), Mains answering (supply: the guard or its cable), Mains switched off, or Wi-Fi down too. */
export type PowerCause = 'blackout' | 'supply' | 'mains_off' | 'unknown';

export interface PowerPlug {
  role: 'mains' | 'tv';
  name: string;
  mac: string;
  ip: string;
  reachable: boolean;
  on: boolean | null;
  onTimeSec: number;
  firmware: string;
  firstFirmware: string;
  hardware: string;
  rssi: number;
  internetBlocked: boolean | null;
  lastSeen: string | null;
}

export interface PowerProblem {
  code: string;
  role?: string;
  since: string;
  text: string;
}

export interface PowerSettings {
  cutoffMinutes: number;
  quietStart: string;
  quietEnd: string;
  /** The Delta's discharge limit as set in the EcoFlow app (it doesn't report it); absent from an older agent. */
  dischargeLimit?: number; // 0–30: it switches its sockets off here
  /** Only from the agent of 2026-10-22, where it was typed in; newer agents learn it (PowerDelta.chargeLimit). */
  chargeLimit?: number;
}

export interface PowerTest {
  start: string;
  ends: string;
  cutoffMinutes: number;
}

export interface PowerCut {
  start: string;
  startApprox?: boolean;
  end: string | null;
  durationSec: number;
  tvOffAt?: string;
  tvRestored?: boolean;
  tvOffAtStart?: boolean;
  extensions?: PowerExtension[];
  overrides?: string[];
  untilPower?: boolean;
  test?: boolean;
  ranOut?: boolean;
  ranOutAt?: string;
  source?: 'hikvision';
  lowestBatteryV?: number;
  peakLoad?: number;
  cause?: PowerCause;
  /** The Delta's lowest % during the cut. */
  lowestCharge?: number;
  /** The Delta's % at the cut's first reading (its start, unless the Delta couldn't be read then). */
  startCharge?: number;
}

export interface PowerStatus {
  configured: boolean;
  reason?: string;
  mains: PowerVerdict;
  mainsSince: string | null;
  cut: PowerCutView | null;
  plugs: PowerPlug[] | null;
  problems: PowerProblem[] | null;
  settings: PowerSettings;
  alertsConfigured: boolean;
  test: PowerTest | null;
  lastCut: PowerCut | null;
  delta: PowerDelta | null;
  /** The Delta is on battery only because Mains just turned on: the power guard waits ~40 s before passing power. */
  guardWaiting?: boolean;
  /** What the Pi has learned about how long the network alone lasts; null without a Delta (older agents omit it). */
  runtime?: PowerRuntime | null;
  /** With the TV group on: whether anyone's watching, from the Delta's load; null when it can't tell. */
  tvInUse?: boolean | null;
  updatedAt: string | null;
}

/** Learned in power cuts from the Delta's own estimate while the TV group was off. */
export interface PowerRuntime {
  /** The network alone on a full Delta; null until learned. */
  networkFullSec: number | null;
  learnedMinutes: number;
  /** The network alone from the current charge. */
  networkNowSec: number | null;
  /** During the countdown on battery: how long the network alone lasts after the TV group switches off, and the % left then. */
  afterSwitchOffSec: number | null;
  chargeAtSwitchOff: number | null;
}

/** The Delta's own reading over its USB-C port. Without `available` there are no numbers, only `error`. */
export interface PowerDelta {
  available: boolean;
  state?: 'on_mains' | 'charging' | 'on_battery';
  lowBattery?: boolean;
  charge?: number;
  /** On battery only. */
  runtimeSec?: number;
  /** Charging only: about this long to the charge limit (to 100% while it charges past the one last seen). */
  fullInSec?: number;
  /** Where the Delta last stopped charging on mains: its charge limit as set in the EcoFlow app (older agents omit it). */
  chargeLimit?: number;
  error?: string;
  readAt?: string;
  // From the Delta's serial port (older agents omit them). Watts are the last minute's average.
  /** Total output: the load on the Delta (the network, plus the TV group when it's on). */
  outW?: number;
  /** Total input; on mains at rest it equals the output (passed through). */
  inW?: number;
  /** Charging: input minus output. */
  chargeW?: number;
  /** The hottest of the four temperatures it reports, °C. */
  tempC?: number;
  firmware?: string;
  /** The serial port is read but gave nothing for 30 s. */
  wattsError?: string;
  // Bluetooth (agents since 2026-10-24).
  /** Where the reading came from: USB (NUT) or Bluetooth (when USB isn't answering). */
  source?: 'usb' | 'bluetooth';
  /** Read over Bluetooth because USB isn't answering: why not. */
  usbError?: string;
  /** Bluetooth is set up but not reading: why not. */
  bluetoothError?: string;
  /** The discharge limit set in the EcoFlow app, as the Delta reports it over Bluetooth. */
  dischargeLimit?: number;
  /** Over Bluetooth: the Delta's USB outputs are off, and its USB link to the Pi with them. */
  usbOutputsOff?: boolean;
  /** Its idle timeout for the USB outputs, in minutes (omitted when it's Never). */
  usbTimeoutMin?: number;
}

export interface PowerEvent {
  at: string;
  kind: 'switch' | 'problem' | 'settings' | 'test' | 'plug' | 'delta';
  detail: string;
  ok: boolean;
  note?: string;
}

export interface PowerPoint {
  t: string;
  mains: PowerVerdict;
  tvOn: boolean | null;
  /** The Delta's last reading in the minute. */
  charge?: number;
  /** The Delta ran on battery at some point in the minute. */
  onBattery?: boolean;
  /** The Delta's load, the minute's average. */
  outW?: number;
}

export interface PowerHistory {
  cuts: PowerCut[] | null;
  events: PowerEvent[] | null;
  series: PowerPoint[] | null;
  since: string | null;
}

export type PowerExtendRequest = { minutes: 10 | 30 } | { until: 'power' } | { off: true };
