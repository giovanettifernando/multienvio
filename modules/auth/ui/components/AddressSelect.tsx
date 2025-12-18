"use client";

import { useState } from "react";
import { App, Empty, Skeleton, Space } from "antd";
import { ELButton, ELSelect } from "@/shared/ui";
import { PlusOutlined } from "@ant-design/icons";
import { useAddresses, useAddressCreate } from "@/modules/account/ui/hooks";
import { AddressModal, type AddressFormValues } from "@/modules/auth/ui/components/AddressModal";
import type { Address } from '@/shared/types/account';

interface AddressSelectProps {
  value?: string | null; // address ID
  onChange?: (addressId: string | null, address?: Address | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AddressSelect({
  value,
  onChange,
  placeholder = "Selecione um endereço de remetente",
  disabled,
}: AddressSelectProps) {
  const { message } = App.useApp();
  const [showModal, setShowModal] = useState(false);

  // Reutilizar hooks existentes
  const addressesQuery = useAddresses();
  const createMutation = useAddressCreate();

  const addresses = addressesQuery.data ?? [];
  const loading = addressesQuery.isLoading;

  // Formatar opções para o Select
  const options = addresses.map((addr) => ({
    value: addr.id,
    label: formatAddressLabel(addr),
    address: addr,
  }));

  // Adicionar opção "+ Adicionar novo..."
  const allOptions = [
    ...options,
    {
      value: "__add_new__",
      label: (
        <Space style={{ color: "#1677ff", fontWeight: 500 }}>
          <PlusOutlined />
          Adicionar novo endereço...
        </Space>
      ),
      address: undefined,
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

    const selected = addresses.find((a) => a.id === selectedValue);
    onChange?.(selectedValue, selected);
  };

  const handleModalSubmit = async (values: AddressFormValues) => {
    try {
      const result = await createMutation.mutateAsync({
        label: values.label,
        cep: values.cep.replace(/\D/g, ""), // Remove máscara
        logradouro: values.logradouro,
        numero: values.numero,
        complemento: values.complemento || undefined,
        bairro: values.bairro,
        cidade: values.cidade,
        uf: values.uf,
      });

      message.success("Endereço salvo com sucesso");
      setShowModal(false);

      // Selecionar o recém-criado (optimistic)
      const newAddress = result?.address;
      if (newAddress?.id) {
        onChange?.(newAddress.id, newAddress);
      }
    } catch (error) {
      message.error("Erro ao salvar endereço");
      console.error(error);
    }
  };

  const handleModalCancel = () => {
    setShowModal(false);
  };

  if (loading) {
    return <Skeleton.Input active block />;
  }

  if (!loading && addresses.length === 0) {
    return (
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nenhum endereço cadastrado"
        >
          <ELButton
            variant="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
          >
            Cadastrar endereço
          </ELButton>
        </Empty>

        <AddressModal
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
      <ELSelect
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
        aria-label="Selecionar endereço de remetente"
      />

      <AddressModal
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
 * Formata endereço para exibição no Select
 * Formato: "Label - Rua X, 123 - Bairro - Cidade/UF"
 */
function formatAddressLabel(addr: Address): string {
  const parts: string[] = [];

  if (addr.label) {
    parts.push(addr.label);
  }

  const street = `${addr.logradouro}, ${addr.numero}${addr.complemento ? ` - ${addr.complemento}` : ""}`;
  parts.push(street);

  parts.push(addr.bairro);
  parts.push(`${addr.cidade}/${addr.uf}`);

  return parts.join(" - ");
}
