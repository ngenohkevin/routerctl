import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: string | number): string {
  const num = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(num) || num === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatBandwidth(speed: string): string {
  if (!speed || speed === '0') return '0 bps';

  const num = parseInt(speed, 10);
  if (isNaN(num)) return speed;

  const k = 1000;
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${parseFloat((num / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatUptime(uptime: string): string {
  if (!uptime) return 'Unknown';

  // RouterOS uptime format: 1w2d3h4m5s
  const weeks = uptime.match(/(\d+)w/);
  const days = uptime.match(/(\d+)d/);
  const hours = uptime.match(/(\d+)h/);
  const minutes = uptime.match(/(\d+)m/);
  const seconds = uptime.match(/(\d+)s/);

  const parts: string[] = [];
  if (weeks) parts.push(`${weeks[1]}w`);
  if (days) parts.push(`${days[1]}d`);
  if (hours) parts.push(`${hours[1]}h`);
  if (minutes) parts.push(`${minutes[1]}m`);
  if (seconds && parts.length === 0) parts.push(`${seconds[1]}s`);

  return parts.join(' ') || uptime;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return 'Just now';

  const weeks = Math.floor(seconds / (7 * 24 * 60 * 60));
  const days = Math.floor((seconds % (7 * 24 * 60 * 60)) / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && weeks === 0) parts.push(`${minutes}m`);

  if (parts.length === 0) {
    return 'Just now';
  }

  return parts.slice(0, 2).join(' ');
}

export function formatMAC(mac: string): string {
  return mac.toUpperCase().replace(/-/g, ':');
}

export function getSignalQuality(
  signalStrength: string | undefined
): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
  if (!signalStrength) return 'unknown';

  const signal = parseInt(signalStrength.replace(/[^-\d]/g, ''), 10);
  if (isNaN(signal)) return 'unknown';

  if (signal >= -50) return 'excellent';
  if (signal >= -60) return 'good';
  if (signal >= -70) return 'fair';
  return 'poor';
}

export function parseMemory(
  free: string,
  total: string
): { used: number; free: number; total: number; percentage: number } {
  const freeNum = parseInt(free, 10) || 0;
  const totalNum = parseInt(total, 10) || 1;
  const usedNum = totalNum - freeNum;
  const percentage = Math.round((usedNum / totalNum) * 100);

  return { used: usedNum, free: freeNum, total: totalNum, percentage };
}

export function parseCPULoad(load: string): number {
  const num = parseInt(load, 10);
  return isNaN(num) ? 0 : num;
}
