"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Form, Input, Modal, Space, message } from "antd";
import type { Order } from "@/types/order";
import { OrderServicePicker } from "@/components/orders/OrderServicePicker";

async function fetchCompany() {
  const response = await fetch("/api/account/company");
  if (!response.ok) {
    throw new Error("Empresa não configurada");
  }
  const payload = await response.json();
  return payload.company;
}

type Props = {
  order: Order;
};

export function OrderActions({ order }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [nfModalOpen, setNfModalOpen] = useState(false);
  const [nfForm] = Form.useForm();

  const updateOrder = async (payload: Record<string, unknown>) => {
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.mensagem ?? "Não foi possível atualizar");
    }
    return response.json();
  };

const quoteMutation = useMutation<void, Error, void>({
  mutationFn: async () => {
    const company = await fetchCompany();
    const payload = {
      origemDestino: {
        cepOrigem: company.endereco.cep,
        cepDestino: order.customer.address.cep,
        coleta: false,
        portaAPorta: false,
      },
      pacote: {
        pesoKg: order.package.pesoKg,
        comprimentoCm: order.package.comprimentoCm,
        larguraCm: order.package.larguraCm,
        alturaCm: order.package.alturaCm,
        valorDeclarado: order.package.declaredValue ?? 0,
      },
    };

   const response = await fetch("/api/cotacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(body?.mensagem ?? "Não foi possível gerar cotação");
    }

    const snapshot = await response.json();
    await updateOrder({ quoteId: snapshot.id });
    messageApi.success("Cotação gerada");
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  },
});
 const emitLabelMutation = useMutation<void, Error, void>({
  mutationFn: async () => {
    if (!order.selectedService) {
      throw new Error("Selecione um serviço antes de emitir");
    }

    const company = await fetchCompany();
    const destinatario = {
      nome: order.customer.name,
      email: order.customer.email,
      telefone: order.customer.phone,
      cep: order.customer.address.cep,
      logradouro: order.customer.address.logradouro,
      numero: order.customer.address.numero,
      complemento: order.customer.address.complemento,
      bairro: order.customer.address.bairro,
      cidade: order.customer.address.cidade,
      uf: order.customer.address.uf,
    };

    const shipmentResponse = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: company,
        destinatario,
        pacote: {
          pesoKg: order.package.pesoKg,
          comprimentoCm: order.package.comprimentoCm,
          larguraCm: order.package.larguraCm,
          alturaCm: order.package.alturaCm,
        },
        servico: {
          serviceCode: order.selectedService.serviceCode,
        },
        serviceName: order.selectedService.serviceCode,
        price: order.selectedService.price,
        etaDays: order.selectedService.etaDays,
      }),
    });

    if (!shipmentResponse.ok) {
      throw new Error("Não foi possível criar o envio");
    }

    const shipment = await shipmentResponse.json();

    const labelResponse = await fetch("/api/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId: shipment.id }),
    });

    if (!labelResponse.ok) {
      throw new Error("Não foi possível gerar a etiqueta");
    }

    await labelResponse.json();
    await updateOrder({ shipmentId: shipment.id });
    messageApi.success("Etiqueta emitida");
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    router.push(`/shipments/${shipment.id}`);
  },
});

const cancelMutation = useMutation<void, Error, void>({
  mutationFn: async () => {
    await updateOrder({ status: "CANCELED" });
    messageApi.success("Pedido cancelado");
    queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  },
});

  return (
    <>
      {contextHolder}
      <Space>
        <Button onClick={() => quoteMutation.mutate()} loading={quoteMutation.isPending}>
          Gerar cotação
        </Button>
        <Button
          onClick={() => setServicePickerOpen(true)}
          disabled={!order.quoteId}
        >
          Selecionar serviço
        </Button>
        <Button
          type="primary"
          onClick={() => emitLabelMutation.mutate()}
          disabled={!order.selectedService || !!order.shipmentId}
          loading={emitLabelMutation.isPending}
        >
          Emitir etiqueta
        </Button>
        <Button onClick={() => setNfModalOpen(true)}>Vincular NF</Button>
        <Button danger onClick={() => cancelMutation.mutate()} loading={cancelMutation.isPending}>
          Cancelar pedido
        </Button>
      </Space>

      <OrderServicePicker
        open={servicePickerOpen}
        quoteId={order.quoteId ?? ""}
        selectedServiceCode={order.selectedService?.serviceCode}
        onClose={() => setServicePickerOpen(false)}
        onSelect={async (service) => {
          await updateOrder({
            selectedService: {
              serviceCode: service.serviceCode,
              price: service.price,
              etaDays: service.etaDays,
            },
          });
          messageApi.success("Serviço selecionado");
          queryClient.invalidateQueries({ queryKey: ["order", order.id] });
          setServicePickerOpen(false);
        }}
      />

      <Modal
        title="Notas fiscais"
        open={nfModalOpen}
        onCancel={() => setNfModalOpen(false)}
        onOk={async () => {
          const values = await nfForm.validateFields();
          await updateOrder({ nf: values });
          messageApi.success("NF vinculada");
          setNfModalOpen(false);
          nfForm.resetFields();
          queryClient.invalidateQueries({ queryKey: ["order", order.id] });
        }}
        confirmLoading={false}
      >
        <Form form={nfForm} layout="vertical">
          <Form.Item name="number" label="Número">
            <Input placeholder="Número da NF" />
          </Form.Item>
          <Form.Item name="key" label="Chave">
            <Input placeholder="Chave de acesso" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
