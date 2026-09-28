'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api } from '@/lib/api';
import type { NetSpeedTestResult, SpeedProgressEvent, SpeedTestServer } from '@/types';

export type TestStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';
export type TestPhase = 'setup' | 'ping' | 'download' | 'upload';

/** One live sample; `at` is progress through its phase (0..1). */
export interface TracePoint {
  at: number;
  mbps: number;
}

export interface SpeedTestState {
  status: TestStatus;
  phase: TestPhase | null;
  /** Narration while the agent sets up (routing switch, server pick). */
  message: string | null;
  /** 0..1 through the current phase. */
  progress: number;
  /** What the gauge shows now: Mbps during a transfer, ms during ping. */
  live: number;
  /** Latest latency-under-load sample during a transfer. */
  liveLatency: number | null;
  ping: number | null;
  jitter: number | null;
  download: number | null;
  upload: number | null;
  latencyDown: number | null;
  latencyUp: number | null;
  trace: { download: TracePoint[]; upload: TracePoint[] };
  server: SpeedTestServer | null;
  isp: string | null;
  /** Which uplink the test runs through ("Faiba"); auto tests learn it at the end. */
  line: string | null;
  result: NetSpeedTestResult | null;
  error: string | null;
}

const initial: SpeedTestState = {
  status: 'idle',
  phase: null,
  message: null,
  progress: 0,
  live: 0,
  liveLatency: null,
  ping: null,
  jitter: null,
  download: null,
  upload: null,
  latencyDown: null,
  latencyUp: null,
  trace: { download: [], upload: [] },
  server: null,
  isp: null,
  line: null,
  result: null,
  error: null,
};

type Action =
  | { type: 'start'; line: string | null }
  | { type: 'event'; ev: SpeedProgressEvent }
  | { type: 'cancel' };

function reduce(s: SpeedTestState, a: Action): SpeedTestState {
  switch (a.type) {
    case 'start':
      return { ...initial, status: 'running', phase: 'setup', line: a.line, message: 'Starting…' };
    case 'cancel':
      return s.status === 'running' ? { ...s, status: 'cancelled', phase: null, live: 0, liveLatency: null } : s;
    case 'event':
      // Events that arrive after a cancel (already in flight) are dropped.
      return s.status === 'running' ? onEvent(s, a.ev) : s;
  }
}

function onEvent(prev: SpeedTestState, ev: SpeedProgressEvent): SpeedTestState {
  const s: SpeedTestState = { ...prev };
  if (ev.isp) s.isp = ev.isp;
  if (ev.server?.id) s.server = ev.server;

  switch (ev.phase) {
    case 'setup':
      s.phase = 'setup';
      s.message = ev.message ?? s.message;
      return s;

    case 'ping':
      if (s.phase !== 'ping') {
        s.phase = 'ping';
        s.progress = 0;
        s.live = 0;
      }
      if (ev.final) {
        s.ping = ev.ping;
        s.jitter = ev.jitter;
        s.live = ev.ping;
        s.progress = 1;
      } else {
        if (ev.ping > 0) s.live = ev.ping;
        if (ev.progress != null) s.progress = ev.progress;
      }
      return s;

    case 'download':
    case 'upload': {
      const phase = ev.phase;
      if (s.phase !== phase) {
        s.phase = phase;
        s.progress = 0;
        s.live = 0;
        s.liveLatency = null;
      }
      // Ping arrives on every event; latch it if the final ping event was missed.
      if (s.ping == null && ev.ping > 0) {
        s.ping = ev.ping;
        s.jitter = ev.jitter;
      }
      if (ev.final) {
        s.live = ev.speed;
        s.progress = 1;
        if (phase === 'download') {
          s.download = ev.speed;
          s.latencyDown = ev.latency || null;
        } else {
          s.upload = ev.speed;
          s.latencyUp = ev.latency || null;
        }
        return s;
      }
      s.live = ev.speed;
      s.progress = ev.progress ?? s.progress;
      if (ev.latency) s.liveLatency = ev.latency;
      if (ev.progress != null) {
        s.trace = { ...s.trace, [phase]: [...s.trace[phase], { at: ev.progress, mbps: ev.speed }] };
      }
      return s;
    }

    case 'done': {
      const r = ev.result;
      if (!r) return s;
      return {
        ...s,
        status: 'done',
        phase: null,
        message: null,
        progress: 1,
        live: r.download,
        liveLatency: null,
        ping: r.ping,
        jitter: r.jitter,
        download: r.download,
        upload: r.upload,
        latencyDown: r.latencyDown || s.latencyDown,
        latencyUp: r.latencyUp || s.latencyUp,
        server: r.server,
        isp: r.isp || s.isp,
        line: r.wanLabel || s.line,
        result: r,
      };
    }

    case 'error':
      return { ...s, status: 'error', phase: null, live: 0, liveLatency: null, error: ev.error || 'Speed test failed' };
  }
  return s;
}

/**
 * The speed test as a state machine over the agent's event stream. One test
 * at a time; the stream is aborted on cancel and on unmount (the agent sees
 * the disconnect and stops transferring).
 */
export function useSpeedTest(onFinished?: (result: NetSpeedTestResult) => void) {
  const [state, dispatch] = useReducer(reduce, initial);
  const abortRef = useRef<(() => void) | null>(null);
  const finishedRef = useRef(onFinished);

  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => () => abortRef.current?.(), []);

  const start = useCallback((opts: { serverID?: string; wan?: string; line?: string } = {}) => {
    abortRef.current?.();
    dispatch({ type: 'start', line: opts.line ?? null });
    abortRef.current = api.runNetSpeedTest(
      opts.serverID,
      (ev) => {
        dispatch({ type: 'event', ev });
        if (ev.phase === 'done' && ev.result) finishedRef.current?.(ev.result);
        if (ev.phase === 'done' || ev.phase === 'error') abortRef.current = null;
      },
      opts.wan
    );
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    dispatch({ type: 'cancel' });
  }, []);

  return { state, start, cancel, running: state.status === 'running' };
}
