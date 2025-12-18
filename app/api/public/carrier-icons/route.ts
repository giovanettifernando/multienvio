/**
 * GET /api/public/carrier-icons
 *
 * Endpoint público para retornar os ícones configurados das transportadoras.
 * Usado na tela de cotação para exibir o logo das transportadoras.
 */

import { prisma } from '@/platform/db/db';
import { withApiHandler } from '@/platform/api/handler';

export const GET = withApiHandler(async () => {
  const carriers = await prisma.carrier.findMany({
    where: {
      status: 'ACTIVE',
      logoUrl: { not: null },
    },
    select: {
      slug: true,
      name: true,
      logoUrl: true,
    },
  });

  // Retorna um mapa de slug -> iconUrl para fácil lookup
  const iconsMap: Record<string, string> = {};
  for (const carrier of carriers) {
    if (carrier.logoUrl) {
      iconsMap[carrier.slug] = carrier.logoUrl;
    }
  }

  return {
    data: iconsMap,
  };
});
