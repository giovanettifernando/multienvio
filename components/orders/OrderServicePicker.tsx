"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Radio,
  Space,
  Typography,
  Button,
} from "antd";
import type { QuoteResult } from "@/components/ui/QuoteResultCard";

async function fetchQuote(id: string) {
  const response = await fetch(`/api/cotacoes?id=${id}`);
  if (!response.ok) {
    throw new Error("Cotação não encontrada");
  }
  return response.json();
}

type Props = {
  open: boolean;
  quoteId: string;
  selectedServiceCode?: string;
  onClose: () => void;
  onSelect: (service: QuoteResult) => void;
};

export function OrderServicePicker({
  open,
  quoteId,
  selectedServiceCode,
  onClose,
  onSelect,
}: Props) {
  const quoteQuery = useQuery({
    queryKey: ["cotacao", quoteId, open],
    queryFn: () => fetchQuote(quoteId),
    enabled: open,
  });

  const resultados = useMemo<QuoteResult[]>(
    () => quoteQuery.data?.cotacao?.resultados ?? [],
    [quoteQuery.data?.cotacao?.resultados],
  );

  return (
    <Modal
      title="Selecionar serviço"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {resultados.length === 0 ? (
          <Typography.Text type="secondary">
            Nenhuma opção disponível. Gere uma nova cotação.
          </Typography.Text>
        ) : (
          <Radio.Group
            defaultValue={selectedServiceCode}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {resultados.map((resultado) => (
                <Radio
                  key={resultado.id}
                  value={resultado.serviceCode}
                  style={{ width: "100%" }}
                  onChange={() => onSelect(resultado)}
                >
                  <Space direction="vertical" size={0} style={{ width: "100%" }}>
                    <Typography.Text strong>
                      {resultado.carrier} · {resultado.name}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Até {new Date(resultado.estimatedDelivery).toLocaleDateString("pt-BR")} ·
                      {" "}
                      {resultado.price.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </Typography.Text>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </Space>
    </Modal>
  );
}
