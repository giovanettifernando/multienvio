"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Flex,
  Form,
  Input,
  InputNumber,
  App,
} from "antd";
import { PageShell } from "@/components/shared/PageShell";
import { ELButton } from "@/components/ui/ELButton";
import { ELModal } from "@/components/ui/ELModal";
import { ActionBar } from "@/components/ui/ActionBar";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import type { CardMethod } from "@/types/billing";
import { PaymentMethodCard } from "@/components/wallet/PaymentMethodCard";

async function fetchCards(): Promise<CardMethod[]> {
  const response = await fetch("/api/account/cards");
  if (!response.ok) {
    throw new Error("Não foi possível carregar cartões");
  }
  const result = await response.json();
  // O endpoint retorna { data: { items, pagination } }
  const items = result?.data?.items ?? result?.items ?? [];
  // Mapear holderName → holder e brand para lowercase
  return items.map((card: { id: string; brand: string; last4: string; holderName?: string; holder?: string; expMonth: number; expYear: number; isDefault?: boolean; mpToken?: string }) => ({
    id: card.id,
    brand: (card.brand?.toLowerCase() ?? "other") as CardMethod["brand"],
    last4: card.last4,
    holder: card.holderName ?? card.holder ?? "",
    expMonth: card.expMonth,
    expYear: card.expYear,
    isDefault: card.isDefault,
    token: card.mpToken ?? "",
  }));
}

export default function MetodosClient() {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);

  const cardsQuery = useQuery({
    queryKey: ["wallet", "cards"],
    queryFn: fetchCards,
  });

  const addCardMutation = useMutation<CardMethod, Error, { holder: string; number: string; expMonth: number; expYear: number; cvc: string }>({
    mutationFn: async (values) => {
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
      <ELModal
        title="Adicionar cartão"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={addCardMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(values) => addCardMutation.mutate(values)}>
          <Form.Item name="holder" label="Titular" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="number" label="Número" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Flex gap={12} wrap="wrap">
            <Form.Item name="expMonth" label="Mês" rules={[{ required: true }]} style={{ flex: '1 1 80px', minWidth: 80 }}>
              <InputNumber min={1} max={12} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="expYear" label="Ano" rules={[{ required: true }]} style={{ flex: '1 1 100px', minWidth: 100 }}>
              <InputNumber min={new Date().getFullYear()} max={new Date().getFullYear() + 15} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cvc" label="CVC" rules={[{ required: true }]} style={{ flex: '1 1 80px', minWidth: 80 }}>
              <Input />
            </Form.Item>
          </Flex>
        </Form>
      </ELModal>

      <PageShell title="Métodos de pagamento" gap="md">
        <ActionBar>
          <ELButton variant="primary" onClick={() => setModalOpen(true)}>
            Adicionar cartão
          </ELButton>
          <ELButton onClick={() => setAddBalanceOpen(true)}>Adicionar saldo</ELButton>
        </ActionBar>

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
