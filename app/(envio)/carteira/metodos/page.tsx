"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  message,
} from "antd";
import { PageShell } from "@/components/shared/PageShell";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import type { CardMethod } from "@/types/billing";
import { PaymentMethodCard } from "@/components/wallet/PaymentMethodCard";

async function fetchCards(): Promise<CardMethod[]> {
  // ✅ Migrado para endpoint real (Prisma) ao invés de mock
  // Usando /api/cards que já faz o mapeamento holderName → holder
  const response = await fetch("/api/cards");
  if (!response.ok) {
    throw new Error("Não foi possível carregar cartões");
  }
  const data = await response.json();
  // O endpoint /api/cards retorna array direto com o mapeamento correto
  return Array.isArray(data) ? data : [];
}

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);

  const cardsQuery = useQuery({
    queryKey: ["wallet", "cards"],
    queryFn: fetchCards,
  });

  const addCardMutation = useMutation<CardMethod, Error, { holder: string; number: string; expMonth: number; expYear: number; cvc: string }>({
    mutationFn: async (values) => {
      // ✅ Migrado para endpoint real (Prisma) ao invés de mock
      const response = await fetch("/api/account/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.message ?? body?.mensagem ?? "Não foi possível adicionar o cartão");
      }
      const result = await response.json();
      // O endpoint real retorna { data: card } com holderName, mapear para holder
      const card = result.data ?? result;
      return {
        ...card,
        holder: card.holderName || card.holder,
        brand: card.brand?.toLowerCase(),
      };
    },
    onSuccess: () => {
      messageApi.success("Cartão adicionado");
      form.resetFields();
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wallet", "cards"] });
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "Não foi possível adicionar o cartão";
      messageApi.error(text);
    },
  });

  const setDefaultMutation = useMutation<void, Error, string>({
    mutationFn: async (cardId) => {
      // ✅ Migrado para endpoint real (Prisma) ao invés de mock
      const res = await fetch(`/api/account/cards/${cardId}/make-default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.message ?? body?.mensagem ?? "Falha ao definir como padrão");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "cards"] });
    },
  });

  const removeMutation = useMutation<void, Error, string>({
    mutationFn: async (cardId) => {
      // ✅ Migrado para endpoint real (Prisma) ao invés de mock
      const res = await fetch(`/api/account/cards/${cardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.message ?? body?.mensagem ?? "Falha ao remover o cartão");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "cards"] });
    },
  });


  const cards = cardsQuery.data ?? [];

  return (
    <>
      {contextHolder}
      <Modal
        title="Adicionar cartão"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={addCardMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(values) => addCardMutation.mutate(values)}>
          <Form.Item name="holder" label="Titular" rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="number" label="Número" rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Row gutter={[12, 0]}>
            <Col xs={8} sm={6}>
              <Form.Item name="expMonth" label="Mês" rules={[{ required: true }]}>
                <InputNumber min={1} max={12} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8} sm={6}>
              <Form.Item name="expYear" label="Ano" rules={[{ required: true }]}>
                <InputNumber min={new Date().getFullYear()} max={new Date().getFullYear() + 15} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={8} sm={6}>
              <Form.Item name="cvc" label="CVC" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <PageShell title="Métodos de pagamento" gap="md">
        <Space>
          <Button type="primary" onClick={() => setModalOpen(true)}>
            Adicionar cartão
          </Button>
          <Button onClick={() => setAddBalanceOpen(true)}>Adicionar saldo</Button>
        </Space>

        <Flex vertical gap={16}>
          {cards.map((card) => (
            <PaymentMethodCard
              key={card.id}
              method={card}
              onSetDefault={(id) => setDefaultMutation.mutate(id)}
              onRemove={(id) => removeMutation.mutate(id)}
            />
          ))}
        </Flex>
      </PageShell>

      <AddFundsModal
        open={addBalanceOpen}
        onClose={() => setAddBalanceOpen(false)}
      />
    </>
  );
}
