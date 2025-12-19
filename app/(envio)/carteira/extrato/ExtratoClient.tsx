"use client";

import { useState } from "react";
import { useELApp, ELSpace, ELCard, ELDatePicker } from '@/shared/ui';
const App = { useApp: useELApp };
const Space = ELSpace;
import { PrinterOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { useWalletTransactions } from "@/modules/wallet/ui/hooks";
import PeriodSummaryCard from '@/modules/wallet/ui/components/PeriodSummaryCard';
import StatementTable from '@/modules/wallet/ui/components/StatementTable';
import StatementPDFModal from '@/modules/wallet/ui/components/StatementPDFModal';
import { PageShell } from '@/shared/ui/PageShell';
import { ELButton } from '@/shared/ui/ELButton';
import { ELInput } from '@/shared/ui/ELInput';
import { ActionBar } from '@/shared/ui/ActionBar';
import tableStyles from "@/shared/ui/ELTableWrapper.module.css";
import gridStyles from "@/shared/ui/ELGrid.module.css";
import { cn } from "@/shared/utils/cn";

const { RangePicker } = ELDatePicker;

// Limite máximo de meses para o período de busca
const MAX_MONTHS_RANGE = 12;

export default function ExtratoClient() {
  const router = useRouter();
  const { message } = App.useApp();

  // Default: últimos 30 dias
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);

  const { data, isLoading } = useWalletTransactions({
    dateFrom: dateRange[0].format('YYYY-MM-DD'),
    dateTo: dateRange[1].format('YYYY-MM-DD'),
    search: search || undefined,
    page,
    limit: 20,
  });

  const transactions = data?.transactions ?? [];
  const summary = data?.summary;
  const pagination = data?.pagination;

  const handlePrintPDF = () => {
    setPdfModalOpen(true);
  };

  return (
    <PageShell
      title="Extrato da Carteira"
      gap="md"
      extra={
        <Space>
          <ELButton onClick={() => router.push("/carteira")}>
            Voltar
          </ELButton>
          <ELButton
            variant="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintPDF}
            disabled={!transactions.length}
          >
            Imprimir / PDF
          </ELButton>
        </Space>
      }
    >
      {/* Filtros */}
      <div className={tableStyles.wrapper}>
        <ELCard>
          <ActionBar variant="compact">
            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  // Validar limite máximo de meses
                  const monthsDiff = dates[1].diff(dates[0], 'months', true);

                  if (monthsDiff > MAX_MONTHS_RANGE) {
                    message.warning(
                      `O período máximo permitido é de ${MAX_MONTHS_RANGE} meses. ` +
                      `Ajustando data final para ${dates[0].add(MAX_MONTHS_RANGE, 'months').format('DD/MM/YYYY')}.`
                    );

                    // Ajustar data final para o máximo permitido
                    const adjustedEndDate = dates[0].add(MAX_MONTHS_RANGE, 'months');
                    setDateRange([dates[0], adjustedEndDate]);
                  } else {
                    setDateRange([dates[0], dates[1]]);
                  }

                  setPage(1); // Reset para primeira página
                }
              }}
              format="DD/MM/YYYY"
              style={{ minWidth: 220 }}
              placeholder={['Data inicial', 'Data final']}
            />
            <ELInput.Search
              placeholder="Buscar por descrição, tipo ou referência..."
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => setPage(1)} // Reset para primeira página
            />
          </ActionBar>
        </ELCard>
      </div>

      {/* Grid: Resumo + Transações lado a lado */}
      <div className={cn(gridStyles.grid, gridStyles.gridSidebar)}>
        {/* Resumo do período */}
        {summary && (
          <PeriodSummaryCard summary={summary} loading={isLoading} />
        )}

        {/* Tabela de transações */}
        <ELCard header={{ title: "Transações" }}>
          <StatementTable
            transactions={transactions}
            loading={isLoading}
            pagination={
              pagination
                ? {
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    onChange: (newPage) => setPage(newPage),
                    showSizeChanger: false,
                    showTotal: (total: number) => `Total: ${total} transações`,
                  }
                : undefined
            }
          />
        </ELCard>
      </div>

      {/* Modal de visualização de PDF */}
      <StatementPDFModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        dateFrom={dateRange[0].format('YYYY-MM-DD')}
        dateTo={dateRange[1].format('YYYY-MM-DD')}
        search={search}
      />
    </PageShell>
  );
}
