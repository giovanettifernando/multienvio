"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useELApp, useELForm, ELForm, ELButton, ELModal, ELInput, ELInputNumber } from '@/shared/ui';
const App = { useApp: useELApp };
const { Input, InputNumber } = { Input: ELInput, InputNumber: ELInputNumber };
import { PageShell } from '@/shared/ui/PageShell';
import { ActionBar } from '@/shared/ui/ActionBar';
import { ELFlex } from '@/shared/ui/ELGrid';
import AddFundsModal from '@/modules/wallet/ui/components/AddFundsModal';
import type { CardMethod } from '@/shared/types/billing';
import { PaymentMethodCard } from "@/modules/wallet/ui/components/PaymentMethodCard";

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
  const [form] = useELForm();
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
        <ELForm form={form} layout="vertical" onFinish={(values) => addCardMutation.mutate(values)}>
          <ELForm.Item name="holder" label="Titular" rules={[{ required: true }]}>
            <Input />
          </ELForm.Item>
          <ELForm.Item name="number" label="Número" rules={[{ required: true }]}>
            <Input />
          </ELForm.Item>
          <ELFlex gap="md" wrap>
            <ELForm.Item name="expMonth" label="Mês" rules={[{ required: true }]} style={{ flex: '1 1 80px', minWidth: 80 }}>
              <InputNumber min={1} max={12} style={{ width: '100%' }} />
            </ELForm.Item>
            <ELForm.Item name="expYear" label="Ano" rules={[{ required: true }]} style={{ flex: '1 1 100px', minWidth: 100 }}>
              <InputNumber min={new Date().getFullYear()} max={new Date().getFullYear() + 15} style={{ width: '100%' }} />
            </ELForm.Item>
            <ELForm.Item name="cvc" label="CVC" rules={[{ required: true }]} style={{ flex: '1 1 80px', minWidth: 80 }}>
              <Input />
            </ELForm.Item>
          </ELFlex>
        </ELForm>
      </ELModal>

      <PageShell title="Métodos de pagamento" gap="md">
        <ActionBar>
          <ELButton variant="primary" onClick={() => setModalOpen(true)}>
            Adicionar cartão
          </ELButton>
          <ELButton onClick={() => setAddBalanceOpen(true)}>Adicionar saldo</ELButton>
        </ActionBar>

        <ELFlex direction="col" gap="lg">
          {cards.map((card) => (
            <PaymentMethodCard
              key={card.id}
              method={card}
              onSetDefault={(id) => setDefaultMutation.mutate(id)}
              onRemove={(id) => removeMutation.mutate(id)}
            />
          ))}
        </ELFlex>
      </PageShell>

      <AddFundsModal
        open={addBalanceOpen}
        onClose={() => setAddBalanceOpen(false)}
      />
    </>
  );
}
