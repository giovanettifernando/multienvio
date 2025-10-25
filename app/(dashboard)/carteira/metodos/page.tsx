"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import type { CardMethod } from "@/types/billing";
import { PaymentMethodCard } from "@/components/wallet/PaymentMethodCard";

async function fetchCards(): Promise<CardMethod[]> {
  const response = await fetch("/api/payments/methods");
  if (!response.ok) {
    throw new Error("Não foi possível carregar métodos");
  }
  const data = await response.json();
  return data.cards ?? [];
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
      const response = await fetch("/api/payments/methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível adicionar o cartão");
      }
      const card = (await response.json()) as CardMethod;
      return card;
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
      const res = await fetch("/api/payments/methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, isDefault: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Falha ao definir como padrão");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet", "cards"] });
    },
  });

  const removeMutation = useMutation<void, Error, string>({
    mutationFn: async (cardId) => {
      const res = await fetch(`/api/payments/methods?id=${cardId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Falha ao remover o cartão");
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
          <Space>
            <Form.Item name="expMonth" label="Mês" rules={[{ required: true }]}
            >
              <InputNumber min={1} max={12} />
            </Form.Item>
            <Form.Item name="expYear" label="Ano" rules={[{ required: true }]}
            >
              <InputNumber min={new Date().getFullYear()} max={new Date().getFullYear() + 15} />
            </Form.Item>
            <Form.Item name="cvc" label="CVC" rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Flex vertical gap={24}>
        <Space direction="vertical" size={4}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Métodos de pagamento
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            Gerencie os cartões utilizados para recarga automática e cobranças.
          </Typography.Paragraph>
        </Space>

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
      </Flex>
      <AddFundsModal
        open={addBalanceOpen}
        onClose={() => setAddBalanceOpen(false)}
        onCardTopupSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
        }}
      />
    </>
  );
}
