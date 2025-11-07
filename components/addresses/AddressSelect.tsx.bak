"use client";

import { Select, Empty, Button, Space } from "antd";
import { useMemo } from "react";
import { useAddressStore } from "@/lib/state/addresses";

type Props = {
  value?: string | null;
  onChange?: (id: string | null) => void;
  onAddAddress?: () => void; // abre o modal
  placeholder?: string;
};

export function AddressSelect({
  value,
  onChange,
  onAddAddress,
  placeholder = "Selecione um endereço",
}: Props) {
  const items = useAddressStore((s) => s.items);

  const options = useMemo(
    () =>
      items.map((a) => ({
        label: `${a.apelido} — ${a.cidade} / ${a.uf} · CEP ${a.cep}`,
        value: a.id,
      })),
    [items]
  );

  if (!items.length) {
    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        <Empty description="Você ainda não tem endereços cadastrados" />
        <Button type="primary" onClick={onAddAddress}>
          Adicionar endereço
        </Button>
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
