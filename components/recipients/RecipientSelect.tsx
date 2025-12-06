"use client";

import { useState } from "react";
import { App, Button, Empty, Select, Skeleton, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useAccountRecipients, useRecipientCreate } from "@/hooks/useAccount";
import { RecipientModal, type RecipientFormValues } from "@/components/recipients/RecipientModal";
import type { Recipient } from "@/types/account";

interface RecipientSelectProps {
  value?: string | null; // recipient ID
  onChange?: (recipientId: string | null, recipient?: Recipient | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RecipientSelect({
  value,
  onChange,
  placeholder = "Selecione um destinatário",
  disabled,
}: RecipientSelectProps) {
  const { message } = App.useApp();
  const [showModal, setShowModal] = useState(false);

  // Reutilizar hooks existentes
  // Buscar todos os recipients (sem filtros)
  const recipientsQuery = useAccountRecipients({
    page: 1,
    pageSize: 1000, // Buscar todos para o select
  });
  const createMutation = useRecipientCreate();

  const recipients = recipientsQuery.data?.items ?? [];
  const loading = recipientsQuery.isLoading;

  // Formatar opções para o Select
  const options = recipients.map((recipient) => ({
    value: recipient.id,
    label: formatRecipientLabel(recipient),
    recipient,
  }));

  // Adicionar opção "+ Adicionar novo..."
  const allOptions = [
    ...options,
    {
      value: "__add_new__",
      label: (
        <Space style={{ color: "#1677ff", fontWeight: 500 }}>
          <PlusOutlined />
          Adicionar novo destinatário...
        </Space>
      ),
      recipient: undefined,
    },
  ];

  const handleChange = (selectedValue: string | undefined) => {
    if (selectedValue === "__add_new__") {
      setShowModal(true);
      return;
    }

    if (!selectedValue) {
      onChange?.(null, undefined);
      return;
    }

    const selected = recipients.find((r) => r.id === selectedValue);
    onChange?.(selectedValue, selected);
  };

  const handleModalSubmit = async (values: RecipientFormValues) => {
    try {
      const result = await createMutation.mutateAsync({
        name: values.name,
        email: values.email || null,
        document: values.doc || null,
        phone: values.phone || null,
        notes: values.notes || null,
        cep: values.cep.replace(/\D/g, ""), // Remove máscara
        logradouro: values.logradouro,
        numero: values.numero,
        complemento: values.complemento || null,
        bairro: values.bairro,
        cidade: values.cidade,
        uf: values.uf,
        isDefault: false,
      });

      message.success("Destinatário salvo com sucesso");
      setShowModal(false);

      // Selecionar o recém-criado (optimistic)
      if (result?.id) {
        onChange?.(result.id, result);
      }
    } catch (error) {
      message.error("Erro ao salvar destinatário");
      console.error(error);
    }
  };

  const handleModalCancel = () => {
    setShowModal(false);
  };

  if (loading) {
    return <Skeleton.Input active block />;
  }

  if (!loading && recipients.length === 0) {
    return (
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nenhum destinatário cadastrado"
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
          >
            Cadastrar destinatário
          </Button>
        </Empty>

        <RecipientModal
          open={showModal}
          loading={createMutation.isPending}
          initialValues={null}
          onSubmit={handleModalSubmit}
          onCancel={handleModalCancel}
        />
      </Space>
    );
  }

  return (
    <>
      <Select
        showSearch
        allowClear
        size="small"
        value={value ?? undefined}
        onChange={handleChange}
        options={allOptions}
        placeholder={placeholder}
        disabled={disabled}
        filterOption={(input, option) => {
          if (option?.value === "__add_new__") return false;
          const label = option?.label;
          if (typeof label === "string") {
            return label.toLowerCase().includes(input.toLowerCase());
          }
          return false;
        }}
        style={{ width: "100%", fontSize: 13 }}
        aria-label="Selecionar destinatário"
      />

      <RecipientModal
        open={showModal}
        loading={createMutation.isPending}
        initialValues={null}
        onSubmit={handleModalSubmit}
        onCancel={handleModalCancel}
      />
    </>
  );
}

/**
 * Formata destinatário para exibição no Select
 * Formato: "Nome - Cidade/UF"
 */
function formatRecipientLabel(recipient: Recipient): string {
  const parts: string[] = [];

  parts.push(recipient.name);

  if (recipient.cidade && recipient.uf) {
    parts.push(`${recipient.cidade}/${recipient.uf}`);
  }

  return parts.join(" - ");
}
