/**
 * Bull Board — Dashboard de filas
 *
 * Integra @bull-board com Express para servir uma UI
 * de monitoramento das filas BullMQ.
 *
 * Acessível via rota Next.js: /api/admin/queues
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueue, getAllQueueNames } from './queues';
import type { QueueName } from './types';

let expressAdapter: ExpressAdapter | null = null;

/**
 * Cria e retorna o Express adapter com Bull Board configurado.
 * Singleton — reutiliza a mesma instância.
 */
export function getBullBoardAdapter(): ExpressAdapter {
  if (expressAdapter) return expressAdapter;

  expressAdapter = new ExpressAdapter();
  expressAdapter.setBasePath('/api/admin/queues');

  const queueNames = getAllQueueNames();
  const adapters = queueNames.map((name: QueueName) =>
    new BullMQAdapter(getQueue(name))
  );

  createBullBoard({
    queues: adapters,
    serverAdapter: expressAdapter,
  });

  return expressAdapter;
}
