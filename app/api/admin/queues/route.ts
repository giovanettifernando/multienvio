/**
 * GET /api/admin/queues[/*]
 *
 * Bull Board dashboard para monitoramento de filas BullMQ.
 * Protegido por autenticação admin.
 *
 * Proxy: encaminha todas as requisições para o Express adapter do Bull Board.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBullBoardAdapter } from '@/platform/queue/board';

// Force Node.js runtime (Bull Board usa APIs incompatíveis com Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxy genérico: converte NextRequest → Express-like → NextResponse
 */
async function handleBullBoard(req: NextRequest): Promise<NextResponse> {
  // TODO: Integrar com requireAdminSession quando pronto
  // Por enquanto, proteger com CRON_SECRET como fallback
  const adminAuth = req.cookies.get('admin_auth')?.value;
  const cronSecret = req.headers.get('x-cron-secret');
  const isDev = process.env.NODE_ENV === 'development';

  if (!adminAuth && !isDev && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adapter = getBullBoardAdapter();
  const expressApp = adapter.getRouter();

  // Construir pseudo-req/res para o Express
  return new Promise<NextResponse>((resolve) => {
    const url = new URL(req.url);
    // O Bull Board espera path relativo ao basePath
    const path = url.pathname.replace('/api/admin/queues', '') || '/';

    const fakeReq = {
      method: req.method,
      url: path + url.search,
      path,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(req.headers),
      params: {},
      body: null,
    };

    const chunks: Buffer[] = [];
    let statusCode = 200;
    const headers: Record<string, string> = {};

    const fakeRes = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this as any;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this as any;
      },
      set(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this as any;
      },
      header(name: string, value: string) {
        headers[name.toLowerCase()] = value;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this as any;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      write(chunk: string | Buffer) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      },
      end(chunk?: string | Buffer) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const body = new Uint8Array(Buffer.concat(chunks));
        const contentType = headers['content-type'] || 'text/html';
        resolve(new NextResponse(body, {
          status: statusCode,
          headers: { 'content-type': contentType, ...headers },
        }));
      },
      json(data: unknown) {
        headers['content-type'] = 'application/json';
        const body = JSON.stringify(data);
        resolve(new NextResponse(body, {
          status: statusCode,
          headers,
        }));
      },
      send(data: string | Buffer) {
        const body = typeof data === 'string' ? data : new Uint8Array(data);
        resolve(new NextResponse(body, {
          status: statusCode,
          headers,
        }));
      },
      redirect(url: string) {
        resolve(NextResponse.redirect(url, 302));
      },
    };

    // Executar Express router
    expressApp(fakeReq as any, fakeRes as any, () => {
      resolve(new NextResponse('Not found', { status: 404 }));
    });
  });
}

export async function GET(req: NextRequest) {
  return handleBullBoard(req);
}

export async function POST(req: NextRequest) {
  return handleBullBoard(req);
}

export async function PUT(req: NextRequest) {
  return handleBullBoard(req);
}
