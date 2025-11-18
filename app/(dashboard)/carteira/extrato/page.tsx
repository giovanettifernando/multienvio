"use client";

import React, { useState } from "react";
import { Card, Button, Row, Col, DatePicker, Input, Space } from "antd";
import { PrinterOutlined, SearchOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs, { Dayjs } from "dayjs";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";
import PeriodSummaryCard from "@/components/wallet/PeriodSummaryCard";
import StatementTable from "@/components/wallet/StatementTable";
import StatementPDFModal from "@/components/wallet/StatementPDFModal";

const { RangePicker } = DatePicker;
const { Search } = Input;

export default function ExtratoPage() {
  const router = useRouter();
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtros */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setDateRange([dates[0], dates[1]]);
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
        </Space>
      </Card>

      {/* Resumo do período */}
      {summary && (
        <PeriodSummaryCard summary={summary} loading={isLoading} />
      )}

      {/* Tabela de transações */}
      <Card
        title="Transações"
        extra={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/carteira")}
            >
              Voltar para a carteira
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
    </div>
  );
}
