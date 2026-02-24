/**
 * Worker Process Manager
 *
 * Gerencia o ciclo de vida do processo de workers BullMQ.
 * Permite start/stop/restart via API (painel admin).
 *
 * O processo roda como child process do Next.js em dev,
 * ou como processo independente em produção (PM2/systemd).
 */

import 'server-only';

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { Queue } from 'bullmq';
import { queueConnection } from './connection';
import { getAllQueueNames } from './queues';
import type { QueueName } from './types';

// ============================================================================
// Estado do processo (singleton por instância Next.js)
// ============================================================================

type WorkerProcessState = {
  process: ChildProcess | null;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid: number | null;
  startedAt: Date | null;
  lastError: string | null;
  logs: string[];
};

const MAX_LOG_LINES = 200;

const globalForWorkers = globalThis as typeof globalThis & {
  __workerState?: WorkerProcessState;
};

if (!globalForWorkers.__workerState) {
  globalForWorkers.__workerState = {
    process: null,
    status: 'stopped',
    pid: null,
    startedAt: null,
    lastError: null,
    logs: [],
  };
}

const state = globalForWorkers.__workerState;

// ============================================================================
// Helpers
// ============================================================================

function pushLog(line: string) {
  const timestamp = new Date().toISOString().slice(11, 19);
  state.logs.push(`[${timestamp}] ${line}`);
  if (state.logs.length > MAX_LOG_LINES) {
    state.logs = state.logs.slice(-MAX_LOG_LINES);
  }
}

// ============================================================================
// Start / Stop / Restart
// ============================================================================

/**
 * Inicia o processo de workers.
 * Não faz nada se já estiver rodando.
 */
export function startWorkerProcess(): { success: boolean; message: string } {
  if (state.status === 'running' && state.process && !state.process.killed) {
    return { success: true, message: 'Workers já estão rodando' };
  }

  state.status = 'starting';
  state.lastError = null;
  state.logs = [];
  pushLog('Starting worker process...');

  try {
    const workerScript = path.join(process.cwd(), 'workers', 'index.ts');

    const child = spawn('npx', ['tsx', '--conditions', 'react-server', workerScript], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env },
    });

    state.process = child;
    state.pid = child.pid ?? null;
    state.startedAt = new Date();
    state.status = 'running';

    pushLog(`Worker process started (PID: ${child.pid})`);

    // Capturar stdout
    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        pushLog(line);
      }
    });

    // Capturar stderr
    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().trim().split('\n');
      for (const line of lines) {
        pushLog(`[ERR] ${line}`);
      }
    });

    // Quando o processo termina
    child.on('exit', (code, signal) => {
      const msg = `Worker process exited (code: ${code}, signal: ${signal})`;
      pushLog(msg);

      if (state.status !== 'stopping') {
        // Saiu sem pedido de stop → erro
        state.status = 'error';
        state.lastError = msg;
      } else {
        state.status = 'stopped';
      }

      state.process = null;
      state.pid = null;
    });

    child.on('error', (err) => {
      pushLog(`[ERR] Process error: ${err.message}`);
      state.status = 'error';
      state.lastError = err.message;
      state.process = null;
      state.pid = null;
    });

    return { success: true, message: `Workers iniciados (PID: ${child.pid})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    state.status = 'error';
    state.lastError = msg;
    pushLog(`[ERR] Failed to start: ${msg}`);
    return { success: false, message: msg };
  }
}

/**
 * Para o processo de workers gracefully (SIGTERM).
 */
export async function stopWorkerProcess(): Promise<{ success: boolean; message: string }> {
  if (!state.process || state.status === 'stopped') {
    state.status = 'stopped';
    return { success: true, message: 'Workers já estão parados' };
  }

  state.status = 'stopping';
  pushLog('Stopping worker process (SIGTERM)...');

  return new Promise((resolve) => {
    const child = state.process!;
    const timeoutMs = 15_000;

    const timeout = setTimeout(() => {
      if (child && !child.killed) {
        pushLog('Graceful shutdown timeout — sending SIGKILL');
        child.kill('SIGKILL');
      }
      state.status = 'stopped';
      state.process = null;
      state.pid = null;
      resolve({ success: true, message: 'Workers parados (forçado)' });
    }, timeoutMs);

    child.once('exit', () => {
      clearTimeout(timeout);
      state.status = 'stopped';
      state.process = null;
      state.pid = null;
      pushLog('Worker process stopped');
      resolve({ success: true, message: 'Workers parados' });
    });

    child.kill('SIGTERM');
  });
}

/**
 * Reinicia o processo de workers (stop + start).
 */
export async function restartWorkerProcess(): Promise<{ success: boolean; message: string }> {
  pushLog('Restarting worker process...');
  await stopWorkerProcess();
  // Pequeno delay para garantir que as conexões Redis fecharam
  await new Promise((r) => setTimeout(r, 1000));
  return startWorkerProcess();
}

// ============================================================================
// Status e métricas
// ============================================================================

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface WorkerStatus {
  process: {
    status: WorkerProcessState['status'];
    pid: number | null;
    startedAt: string | null;
    uptimeSeconds: number | null;
    lastError: string | null;
  };
  queues: QueueStats[];
  logs: string[];
}

/**
 * Retorna status completo dos workers + filas.
 */
export async function getWorkerStatus(): Promise<WorkerStatus> {
  // Buscar métricas de cada fila
  const queueNames = getAllQueueNames();
  const queues: QueueStats[] = [];

  for (const name of queueNames) {
    try {
      const q = new Queue(name, { connection: queueConnection });
      const counts = await q.getJobCounts();
      queues.push({
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0,
      });
      await q.close();
    } catch {
      queues.push({ name, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 });
    }
  }

  const uptimeSeconds = state.startedAt
    ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
    : null;

  return {
    process: {
      status: state.status,
      pid: state.pid,
      startedAt: state.startedAt?.toISOString() ?? null,
      uptimeSeconds,
      lastError: state.lastError,
    },
    queues,
    logs: state.logs.slice(-100), // Últimas 100 linhas
  };
}

/**
 * Retorna apenas o status resumido (sem métricas de fila).
 * Mais rápido — não consulta Redis.
 */
export function getWorkerProcessStatus(): Pick<WorkerStatus, 'process' | 'logs'> {
  const uptimeSeconds = state.startedAt
    ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
    : null;

  return {
    process: {
      status: state.status,
      pid: state.pid,
      startedAt: state.startedAt?.toISOString() ?? null,
      uptimeSeconds,
      lastError: state.lastError,
    },
    logs: state.logs.slice(-100),
  };
}
