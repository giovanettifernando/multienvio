'use client';

import { useState } from 'react';
import { Card, Select, Button, Flex, App } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { PeriodFilter } from '@/modules/admin/application/finance/types';
import { downloadReportCSV } from '@/modules/admin/application/finance/api';

interface ReportsProps {
  period: PeriodFilter;
}

type ReportType = 'dre' | 'taxes' | 'fees';

const reportOptions = [
  { label: 'DRE (Demonstração do Resultado)', value: 'dre' },
  { label: 'Relatório de Taxas', value: 'taxes' },
  { label: 'Relatório de Fees', value: 'fees' },
];

export function Reports({ period }: ReportsProps) {
  const { message } = App.useApp();
  const [selectedReport, setSelectedReport] = useState<ReportType>('dre');
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await downloadReportCSV({
        report: selectedReport,
        ...period,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-${selectedReport}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      message.success('Relatório baixado com sucesso');
    } catch {
      message.error('Falha ao baixar relatório');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card title="Relatórios" size="small">
      <Flex vertical gap={16}>
        <div>
          <p style={{ marginBottom: 8 }}>
            Selecione o tipo de relatório que deseja gerar. Os relatórios são gerados em formato CSV
            e contêm dados agregados do período selecionado.
          </p>
        </div>

        <Flex gap={12} align="center">
          <Select
            value={selectedReport}
            onChange={setSelectedReport}
            options={reportOptions}
            style={{ width: 300 }}
          />
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            loading={downloading}
          >
            Gerar e Baixar CSV
          </Button>
        </Flex>

        <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <h4 style={{ marginTop: 0 }}>Sobre os Relatórios:</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>DRE:</strong> Demonstração do resultado com receitas, despesas e resultado operacional
            </li>
            <li>
              <strong>Taxas:</strong> Detalhamento de todas as taxas cobradas por tipo e método de pagamento
            </li>
            <li>
              <strong>Fees:</strong> Relatório de fees cobrados em cada operação com detalhamento por cliente
            </li>
          </ul>
        </div>
      </Flex>
    </Card>
  );
}
