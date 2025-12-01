"use client";

import React, { useState } from "react";
import { Card, Button, Row, Col, DatePicker, Input, Space, App } from "antd";
import { PrinterOutlined, SearchOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";
import PeriodSummaryCard from "@/components/wallet/PeriodSummaryCard";
import StatementTable from "@/components/wallet/StatementTable";
import StatementPDFModal from "@/components/wallet/StatementPDFModal";
import { PageShell } from "@/components/shared/PageShell";

const { RangePicker } = DatePicker;
const { Search } = Input;

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
          <Button onClick={() => router.push("/carteira")}>
            Voltar
          </Button>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintPDF}
            disabled={!transactions.length}
          >
            Imprimir / PDF
          </Button>
        </Space>
      }
    >
      {/* Filtros */}
      <Card>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
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
              style={{ width: '100%' }}
              placeholder={['Data inicial', 'Data final']}
            />
          </Col>
          <Col xs={24} md={12}>
            <Search
              placeholder="Buscar por descrição, tipo ou referência..."
              allowClear
              enterButton={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onSearch={() => setPage(1)} // Reset para primeira página
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </Card>

      {/* Resumo do período */}
      {summary && (
        <PeriodSummaryCard summary={summary} loading={isLoading} />
      )}

      {/* Tabela de transações */}
      <Card title="Transações">
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
      </Card>

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
