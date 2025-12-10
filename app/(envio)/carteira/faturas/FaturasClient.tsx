"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InputNumber, App } from "antd";
import { ELCard } from "@/components/ui/ELCard";
import { PageShell } from "@/components/shared/PageShell";
import type { Invoice } from "@/types/billing";
import { ELButton } from "@/components/ui/ELButton";
import { ELAlert } from "@/components/ui/ELAlert";
import { ELModal } from "@/components/ui/ELModal";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import tableStyles from "@/components/ui/ELTableWrapper.module.css";

async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetch("/api/invoices");
  if (!response.ok) {
    throw new Error("Não foi possível carregar as faturas");
  }
  const data = await response.json();
  return data.invoices ?? [];
}

export default function FaturasClient() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState<number>(100);
  const { data, isLoading } = useQuery({
    queryKey: ["wallet", "invoices"],
    queryFn: fetchInvoices,
  });

  const generateMutation = useMutation<Invoice, Error, void>({
    mutationFn: async () => {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível gerar a fatura");
      }
      const inv = (await response.json()) as Invoice;
      return inv;
    },
    onSuccess: () => {
      message.success("Fatura gerada");
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wallet", "invoices"] });
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Não foi possível gerar a fatura";
      message.error(text);
    },
  });

  const columns: DataTableColumn<Invoice>[] = [
    {
      title: "Número",
      dataIndex: "number",
      key: "number",
      showInCard: true,
      cardLabel: "Nº",
    },
    {
      title: "Valor",
      dataIndex: "amount",
      key: "amount",
      showInCard: true,
      cardLabel: "Valor",
      render: (value) =>
        (value as number).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
    },
    {
      title: "Gerada em",
      dataIndex: "createdAt",
      key: "createdAt",
      showInCard: true,
      cardLabel: "Data",
      render: (value) => new Date(value as string).toLocaleString("pt-BR"),
    },
    {
      title: "Ações",
      key: "actions",
      isActions: true,
      render: (_value, record) => (
        <ELButton variant="link" href={record.pdfUrl} target="_blank">
          Baixar PDF
        </ELButton>
      ),
    },
  ];

  return (
    <>
      <ELModal
        title="Gerar fatura"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => generateMutation.mutate()}
        confirmLoading={generateMutation.isPending}
      >
        <InputNumber
          min={10}
          step={50}
          value={amount}
          onChange={(value) => setAmount(value ?? 10)}
          style={{ width: "100%" }}
        />
      </ELModal>

      <PageShell title="Faturas e recibos" gap="md">
        <ELAlert
          variant="info"
          title="Modo de Demonstração"
          description="Esta seção está usando dados simulados (mock). A funcionalidade de faturas será implementada quando a integração com o gateway de pagamento estiver completa."
          closable
        />

        <ELButton variant="primary" onClick={() => setModalOpen(true)}>
          Gerar nova fatura
        </ELButton>

        <div className={tableStyles.wrapper}>
          <ELCard padding="none">
            <DataTable<Invoice>
              rowKey="id"
              loading={isLoading}
              data={data ?? []}
              columns={columns}
              enableMobileCards
              scrollX={600}
              emptyMessage="Nenhuma fatura encontrada"
              emptyDescription="Gere uma nova fatura para começar"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `Total: ${total} faturas`,
              }}
            />
          </ELCard>
        </div>
      </PageShell>
    </>
  );
}
