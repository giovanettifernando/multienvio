"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, InputNumber, Modal, Table, message, Alert } from "antd";
import { PageShell } from "@/components/shared/PageShell";
import type { Invoice } from "@/types/billing";

async function fetchInvoices(): Promise<Invoice[]> {
  const response = await fetch("/api/invoices");
  if (!response.ok) {
    throw new Error("Não foi possível carregar as faturas");
  }
  const data = await response.json();
  return data.invoices ?? [];
}

export default function FaturasClient() {
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

  return (
    <>
      <Modal
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
      </Modal>

      <PageShell title="Faturas e recibos" gap="md">
        <Alert
          message="⚠️ Modo de Demonstração"
          description="Esta seção está usando dados simulados (mock). A funcionalidade de faturas será implementada quando a integração com o gateway de pagamento estiver completa."
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />

        <Button type="primary" onClick={() => setModalOpen(true)}>
          Gerar nova fatura
        </Button>

        <Card variant="borderless">
          <Table
            rowKey="id"
            loading={isLoading}
            dataSource={data ?? []}
            scroll={{ x: 600 }}
            columns={[
              {
                title: "Número",
                dataIndex: "number",
              },
              {
                title: "Valor",
                dataIndex: "amount",
                render: (value: number) =>
                  value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }),
              },
              {
                title: "Gerada em",
                dataIndex: "createdAt",
                render: (value: string) => new Date(value).toLocaleString("pt-BR"),
              },
              {
                title: "Ações",
                render: (_, record: Invoice) => (
                  <Button type="link" href={record.pdfUrl} target="_blank">
                    Baixar PDF
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </PageShell>
    </>
  );
}
