"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Empty,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Tabs,
  message,
} from "antd";
import type { PixTopup } from "@/types/billing";
import { PixQRCode } from "@/components/wallet/PixQRCode";
import { useCards } from "@/hooks/useAccount";

async function createPixTopup(amount: number): Promise<PixTopup> {
  const response = await fetch("/api/payments/topups/pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.mensagem ?? "Não foi possível gerar o PIX");
  }
  const data = await response.json();
  return (data && "topup" in data ? data.topup : data) as PixTopup;
}


export type AddFundsModalProps = {
  open: boolean;
  onClose: () => void;
  onCardTopupSuccess?: () => void;
};

export function AddFundsModal({
  open,
  onClose,
  onCardTopupSuccess,
}: AddFundsModalProps) {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [pixTopup, setPixTopup] = useState<PixTopup | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | undefined>();

  const { data: cards, isLoading: loadingCards } = useCards();

  const cardOptions = useMemo(
    () =>
      (cards ?? []).map((card) => ({
        label: `${card.brand} •••• ${card.last4} — ${card.holderName}`,
        value: card.id,
      })),
    [cards],
  );

  useEffect(() => {
    if (selectedCardId || !cardOptions.length) return;
    setSelectedCardId(cardOptions[0]?.value);
  }, [cardOptions, selectedCardId]);

  const pixMutation = useMutation<PixTopup, Error, number>({
    mutationFn: createPixTopup,
    onSuccess: (data) => {
      setPixTopup(data);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      messageApi.success("Saldo adicionado com sucesso");
    },
    onError: (error) => {
      messageApi.error(error.message);
    },
  });

  const cardMutation = useMutation<
    unknown,
    Error,
    { amount: number; cardId?: string }
  >({
    mutationFn: async (payload) => {
      const response = await fetch("/api/payments/topups/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => undefined);
        throw new Error(body?.mensagem ?? "Não foi possível processar o pagamento");
      }
      return response.json();
    },
    onSuccess: () => {
      messageApi.success("Saldo adicionado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      onCardTopupSuccess?.();
      onClose();
    },
    onError: (error) => {
      messageApi.error(error.message);
    },
  });

  return (
    <>
      {contextHolder}
      <Modal
        title="Adicionar saldo"
        open={open}
        onCancel={() => {
          setPixTopup(null);
          onClose();
        }}
        footer={null}
      >
        <Tabs
          items={[
            {
              key: "pix",
              label: "PIX",
              children: pixTopup ? (
                <PixQRCode topup={pixTopup} />
              ) : (
                <Form
                  layout="vertical"
                  onFinish={(values: { amount: number }) => pixMutation.mutate(values.amount)}
                >
                  <Form.Item name="amount" label="Valor" rules={[{ required: true }]}
                  >
                    <InputNumber min={1} step={10} style={{ width: "100%" }} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={pixMutation.isPending}>
                    Gerar QR Code
                  </Button>
                </Form>
              ),
            },
            {
              key: "card",
              label: "Cartão",
              children: (
                <Form
                  layout="vertical"
                  onFinish={(values: { amount: number; cardId?: string }) =>
                    cardMutation.mutate({
                      amount: values.amount,
                      cardId: values.cardId ?? selectedCardId,
                    })
                  }
                >
                  <Form.Item
                    name="amount"
                    label="Valor"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} step={10} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item
                    name="cardId"
                    label="Cartão"
                    rules={[{ required: true, message: "Selecione um cartão." }]}
                  >
                    <Select
                      placeholder="Selecione um cartão"
                      value={selectedCardId}
                      onChange={setSelectedCardId}
                      options={cardOptions}
                      loading={loadingCards}
                      notFoundContent={
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description="Não há cartões"
                        />
                      }
                    />
                  </Form.Item>
                  {!loadingCards && (cards?.length ?? 0) === 0 ? (
                    <Form.Item>
                      <Button
                        type="default"
                        onClick={() => {
                          window.location.href = "/minha-conta#cards";
                        }}
                        block
                      >
                        Cadastrar cartão
                      </Button>
                    </Form.Item>
                  ) : null}
                  <Button type="primary" htmlType="submit" loading={cardMutation.isPending}>
                    Pagar com cartão
                  </Button>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </>
  );
}

export default AddFundsModal;
