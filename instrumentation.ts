/**
 * Next.js Instrumentation
 *
 * Este arquivo é executado automaticamente quando o servidor Next.js inicia.
 * Usado para inicializar serviços de background que precisam rodar continuamente.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Só executar no servidor Node.js (não no Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Importar dinamicamente para evitar problemas com bundling
    const { startCleanupJob } = await import('@/modules/tracking/application/cleanup.service');

    // Iniciar job de limpeza de reservas de códigos de rastreamento
    startCleanupJob();

    console.log('[INSTRUMENTATION] Background jobs initialized');
  }
}
