"use client";
import { Select, Empty, Button, Space } from "antd";
import { useRecipientsStore } from "@/lib/state/recipients";
import { useMemo } from "react";

type Props = {
  value?: string | null;
  onChange?: (id: string | null) => void;
  onAddRecipient?: () => void; // abre modal
  placeholder?: string;
};

export function RecipientSelect({
  value,
  onChange,
  onAddRecipient,
  placeholder = "Selecione um destinatário"
}: Props) {
  const items = useRecipientsStore((s) => s.items);
  const options = useMemo(
    () => items.map(r => ({
      label: `${r.name} — ${r.cidade}/${r.uf} · CEP ${r.cep}`,
      value: r.id,
    })),
    [items]
  );

  if (!items.length) {
    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Empty description="Você ainda não tem destinatários recorrentes" />
        {onAddRecipient && (
          <Button type="primary" onClick={onAddRecipient}>
            Adicionar destinatário
          </Button>
        )}
      </Space>
    );
  }

  return (
    <Select
      showSearch
      allowClear
      placeholder={placeholder}
      value={value ?? undefined}
      options={options}
      onChange={(v) => onChange?.(v ?? null)}
      filterOption={(input, option) =>
        (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
      }
      style={{ width: "100%" }}
    />
  );
}
