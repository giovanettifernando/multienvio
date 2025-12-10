/**
 * GET /api/admin/finance/reports
 *
 * Returns CSV reports for finance data (DRE, taxes, fees)
 *
 * NOTE: This route returns CSV data, so it uses withApiHandlerResponse
 * which allows returning NextResponse directly instead of JSON format.
 */

import { NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';

export const GET = withApiHandlerResponse(async ({ req, logger }) => {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autenticado',
      status: 401,
    });
  }

  const permissionError = requirePermission(session, AdminPermission.FINANCEIRO);
  if (permissionError) {
    throw new ApiError({
      code: 'FORBIDDEN',
      message: 'Permissão negada',
      status: 403,
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const report = searchParams.get('report') || 'dre';
  const dateStart = searchParams.get('dateStart') || '';
  const dateEnd = searchParams.get('dateEnd') || '';

  // Generate CSV based on report type
  let csv = '';

  switch (report) {
    case 'dre':
      csv = `Relatório DRE,Período: ${dateStart} a ${dateEnd}\n\n`;
      csv += `Categoria,Valor\n`;
      csv += `Receita Bruta,850000.00\n`;
      csv += `(-) Taxas Plataforma,42500.00\n`;
      csv += `(-) Repasses Transportadoras,650000.00\n`;
      csv += `(-) Comissões,25000.00\n`;
      csv += `(-) Estornos,12000.00\n`;
      csv += `(-) Chargebacks,3500.00\n`;
      csv += `= Resultado Operacional,117000.00\n`;
      break;

    case 'taxes':
      csv = `Relatório de Taxas,Período: ${dateStart} a ${dateEnd}\n\n`;
      csv += `Tipo,Método,Quantidade,Total\n`;
      csv += `Taxa MDR,Cartão,150,4500.00\n`;
      csv += `Taxa Boleto,Boleto,45,157.50\n`;
      csv += `Taxa PIX,PIX,320,0.00\n`;
      csv += `Taxa Mensal,Plataforma,85,1275.00\n`;
      break;

    case 'fees':
      csv = `Relatório de Fees,Período: ${dateStart} a ${dateEnd}\n\n`;
      csv += `Operação,Cliente,Valor,Fee\n`;
      csv += `Depósito Cartão,Tech Solutions Ltda,5000.00,150.00\n`;
      csv += `Depósito Boleto,Loja Virtual XPTO,10000.00,3.50\n`;
      csv += `Compra Etiqueta,E-commerce ABC,45.50,2.28\n`;
      csv += `Compra Etiqueta,Marketplace 123,38.90,1.95\n`;
      break;
  }

  const fileName = `relatorio-${report}-${Date.now()}.csv`;
  logger.info('finance_report_generated', { report, dateStart, dateEnd, fileName });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
});
