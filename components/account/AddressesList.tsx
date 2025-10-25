"use client";

import React from "react";
import { useState } from "react";
import {
  App,
  Button,
  Card,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useAddressStore, makeAddressFromForm, type Address } from "@/lib/state/addresses";
import { AddressModal, type AddressFormValues } from "./AddressModal";

export default function AddressesList() {
  const { message } = App.useApp();
  const items = useAddressStore((s) => s.items);
  const add = useAddressStore((s) => s.add);
  const update = useAddressStore((s) => s.update);
  const remove = useAddressStore((s) => s.remove);
  const setDefault = useAddressStore((s) => s.setDefault);

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Address | null>(null);
  const [showModal, setShowModal] = useState(false);

  const addresses = items;

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

  const handleSubmit = (values: AddressFormValues) => {
    if (modalMode === "create") {
      const newAddress = {
        ...makeAddressFromForm(values),
        apelido: values.label,
      };
      add(newAddress, { select: false });
      message.success("Endereço adicionado.");
      setShowModal(false);
      return;
    }

    if (!editing?.id) {
      message.error("Selecione um endereço para editar.");
      return;
    }

    update(editing.id, {
      apelido: values.label,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
      isDefault: values.isDefault,
    });

    message.success("Endereço atualizado.");
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    remove(id);
    message.success("Endereço removido.");
  };

  const handleMakeDefault = (id: string) => {
    setDefault(id);
    message.success("Endereço definido como padrão.");
  };

  return (
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
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button key="edit" type="link" onClick={() => handleOpenEdit(item)}>
                Editar
              </Button>,
              <Button
                key="default"
                type="link"
                onClick={() => handleMakeDefault(item.id)}
                disabled={item.isDefault}
              >
                Tornar padrão
              </Button>,
              <Popconfirm
                key="delete"
                title="Remover endereço"
                okText="Remover"
                cancelText="Cancelar"
                onConfirm={() => handleDelete(item.id)}
              >
                <Button type="link" danger>
                  Remover
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text strong>{item.apelido}</Typography.Text>
                  {item.isDefault ? <Tag color="green">Padrão</Tag> : null}
                </Space>
              }
              description={
                <Typography.Text type="secondary">
                  {item.logradouro}, {item.numero}
                  {item.complemento ? ` - ${item.complemento}` : ""} — {item.bairro},{" "}
                  {item.cidade}/{item.uf} · CEP {item.cep}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />

      <AddressModal
        open={showModal}
        initialValues={
          editing
            ? {
                label: editing.apelido,
                cep: editing.cep,
                logradouro: editing.logradouro,
                numero: editing.numero,
                complemento: editing.complemento,
                bairro: editing.bairro,
                cidade: editing.cidade,
                uf: editing.uf,
                isDefault: editing.isDefault,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowModal(false);
          setEditing(null);
        }}
      />
    </Card>
  );
}
