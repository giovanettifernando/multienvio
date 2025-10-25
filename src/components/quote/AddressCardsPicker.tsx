"use client";

import React from "react";
import { Card, Empty, Radio, Space, Typography, Button } from "antd";
import type { Address } from "@/types/account";

type Props = {
  addresses: Address[];
  value?: string;
  onChange?: (addressId: string) => void;
  onCreateAddress?: () => void;
};

export default function AddressCardsPicker({
  addresses,
  value,
  onChange,
  onCreateAddress,
}: Props) {
  if (!addresses?.length) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" align="center">
              <Typography.Text>Você ainda não cadastrou endereços.</Typography.Text>
              <Button type="primary" onClick={onCreateAddress}>
                Cadastrar endereço
              </Button>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <Radio.Group
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      style={{ width: "100%" }}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        {addresses.map((address) => (
          <Card
            key={address.id}
            hoverable
            onClick={() => onChange?.(address.id)}
            style={{
              borderColor: value === address.id ? "var(--ant-color-primary)" : undefined,
            }}
            styles={{ body: { padding: 16 } }}
          >
            <Space align="start" size={16}>
              <Radio value={address.id} />
              <div>
                <Typography.Text strong>
                  {address.label}
                  {address.isDefault ? " (padrão)" : ""}
                </Typography.Text>
                <div>
                  <Typography.Text type="secondary">
                    {address.logradouro}, {address.numero}
                    {address.complemento ? `, ${address.complemento}` : ""} — {address.bairro}
                  </Typography.Text>
                </div>
                <div>
                  <Typography.Text type="secondary">
                    {address.cidade}/{address.uf} • CEP {address.cep}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          </Card>
        ))}
      </Space>
    </Radio.Group>
  );
}
