"use client";

import React, { useState } from "react";
import {
  App,
  Button,
  Card,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
  Spin,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled } from "@ant-design/icons";
import { useAddresses, useAddressCreate, useAddressUpdate, useAddressDelete } from "@/hooks/useAccount";
import { AddressModal, type AddressFormValues } from "./AddressModal";
import type { Address } from "@/types/account";

export default function AddressesList() {
  const { message } = App.useApp();
  
  const { data: addresses = [], isLoading, refetch } = useAddresses();
  const createMutation = useAddressCreate();

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Address | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditing(null);
    setShowModal(true);
  };

  const handleOpenEdit = (address: Address) => {
    setModalMode("edit");
    setEditing(address);
    setShowModal(true);
  };

  const handleSubmit = async (values: AddressFormValues) => {
    try {
      const payload: Partial<Address> = {
        label: values.label.trim(),
        cep: values.cep,
        logradouro: values.logradouro,
        numero: values.numero,
        complemento: values.complemento?.trim() || undefined,
        bairro: values.bairro,
        cidade: values.cidade,
        uf: values.uf,
        isDefault: values.isDefault || false,
      };

      if (modalMode === "create") {
        const result = await createMutation.mutateAsync(payload);
        
        console.log('[AddressesList] Created address:', result);
        message.success("Endereço adicionado com sucesso!");
        setShowModal(false);
        return;
      }

      // Edit mode
      if (!editing?.id) {
        message.error("Selecione um endereço para editar.");
        return;
      }

      const response = await fetch(`/api/account/addresses/${editing.id}`, {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Falha ao atualizar endereço");
      }

      message.success("Endereço atualizado com sucesso!");
      setShowModal(false);
      setEditing(null);
      refetch();
    } catch (error) {
      console.error('[AddressesList] Error:', error);
      message.error(error instanceof Error ? error.message : "Erro ao salvar endereço");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("Falha ao remover endereço");
      }

      message.success("Endereço removido com sucesso!");
      refetch();
    } catch (error) {
      console.error('[AddressesList] Delete error:', error);
      message.error(error instanceof Error ? error.message : "Erro ao remover endereço");
    }
  };

  const handleMakeDefault = async (id: string) => {
    const address = addresses.find((a) => a.id === id);
    if (!address) return;

    try {
      const response = await fetch(`/api/account/addresses/${id}`, {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...address,
          isDefault: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao definir endereço padrão");
      }

      message.success("Endereço definido como padrão!");
      refetch();
    } catch (error) {
      console.error('[AddressesList] Make default error:', error);
      message.error(error instanceof Error ? error.message : "Erro ao definir endereço padrão");
    }
  };

  if (isLoading) {
    return (
      <Card title="Endereços">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card
        title="Endereços"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Adicionar endereço
          </Button>
        }
      >
        <List
          dataSource={addresses}
          locale={{ emptyText: "Nenhum endereço cadastrado." }}
          renderItem={(address) => (
            <List.Item
              actions={[
                <Button
                  key="default"
                  type="text"
                  icon={address.isDefault ? <StarFilled style={{ color: "#faad14" }} /> : <StarOutlined />}
                  onClick={() => !address.isDefault && handleMakeDefault(address.id)}
                  disabled={address.isDefault}
                >
                  {address.isDefault ? "Padrão" : "Tornar padrão"}
                </Button>,
                <Button
                  key="edit"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEdit(address)}
                >
                  Editar
                </Button>,
                <Popconfirm
                  key="delete"
                  title="Tem certeza que deseja remover este endereço?"
                  onConfirm={() => handleDelete(address.id)}
                  okText="Remover"
                  cancelText="Cancelar"
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>
                    Remover
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {address.label && <Tag color="blue">{address.label}</Tag>}
                    {address.isDefault && <Tag color="gold">Padrão</Tag>}
                  </Space>
                }
                description={
                  <>
                    <Typography.Text>
                      {address.logradouro}, {address.numero}
                      {address.complemento && ` - ${address.complemento}`}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">
                      {address.bairro}, {address.cidade} - {address.uf}
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary">CEP: {address.cep}</Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <AddressModal
        open={showModal}
        initialValues={
          editing
            ? {
                label: editing.label || "",
                cep: editing.cep,
                logradouro: editing.logradouro,
                numero: editing.numero,
                complemento: editing.complemento || "",
                bairro: editing.bairro,
                cidade: editing.cidade,
                uf: editing.uf,
                isDefault: editing.isDefault || false,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowModal(false);
          setEditing(null);
        }}
        loading={createMutation.isPending}
      />
    </>
  );
}
