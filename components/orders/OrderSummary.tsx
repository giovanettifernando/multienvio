"use client";

import { Card, Descriptions, Typography } from "antd";
import type { Order } from "@/types/order";

type Props = {
  order: Order;
};

export function OrderSummary({ order }: Props) {
  const { customer, package: pkg, items } = order;

  const itensResumo = items?.reduce(
    (acc, item) => acc + item.qty * (item.unitPrice ?? 0),
    0,
  );

  return (
    <Card title="Resumo" variant="borderless" style={{ minWidth: 320 }}>
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Cliente">
          <Typography.Text strong>{customer.name}</Typography.Text>
          <Typography.Paragraph style={{ margin: 0 }}>
            {customer.address.logradouro}, {customer.address.numero}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            {customer.address.bairro} · {customer.address.cidade}/
            {customer.address.uf} — CEP {customer.address.cep}
          </Typography.Paragraph>
        </Descriptions.Item>
        <Descriptions.Item label="Pacote">
          {pkg.pesoKg} kg · {pkg.comprimentoCm} x {pkg.larguraCm} x {pkg.alturaCm} cm
        </Descriptions.Item>
        <Descriptions.Item label="Valor declarado">
          {pkg.declaredValue?.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }) ?? "R$ 0,00"}
        </Descriptions.Item>
        <Descriptions.Item label="Itens">
          {items?.length ?? 0} itens
          {itensResumo
            ? ` · ${itensResumo.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}`
            : ""}
        </Descriptions.Item>
        {order.selectedService ? (
          <Descriptions.Item label="Serviço selecionado">
            {order.selectedService.serviceCode} ·
            {" "}
            {order.selectedService.price.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </Descriptions.Item>
        ) : null}
        {order.nf?.number || order.nf?.key ? (
          <Descriptions.Item label="NF">
            {order.nf.number ? `Número: ${order.nf.number}` : null}
            {order.nf.key ? ` · Chave: ${order.nf.key}` : null}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
    </Card>
  );
}
