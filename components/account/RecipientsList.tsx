"use client";

import React, { useState, useMemo } from "react";
import {
  App,
  Button,
  Card,
  Input,
  List,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useRecipientsStore, type Recipient } from "@/lib/state/recipients";
import { RecipientModal, type RecipientFormValues } from "@/components/recipients/RecipientModal";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function RecipientsList() {
  const { message } = App.useApp();
  const items = useRecipientsStore((s) => s.items);
  const add = useRecipientsStore((s) => s.add);
  const update = useRecipientsStore((s) => s.update);
  const remove = useRecipientsStore((s) => s.remove);

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchText, setSearchText] = useState("");

  const filteredRecipients = useMemo(() => {
    if (!searchText.trim()) return items;
    const lower = searchText.toLowerCase();
    return items.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.cep.includes(searchText) ||
        r.cidade.toLowerCase().includes(lower) ||
        r.doc?.includes(searchText)
    );
  }, [items, searchText]);

  const handleOpenCreate = () => {
    setModalMode("create");
    setEditing(null);
    setShowModal(true);
  };

  const handleOpenEdit = (recipient: Recipient) => {
    setModalMode("edit");
    setEditing(recipient);
    setShowModal(true);
  };

  const handleSubmit = (values: RecipientFormValues) => {
    if (modalMode === "create") {
      const newRecipient: Recipient = {
        id: uid(),
        name: values.name,
        doc: values.doc,
        phone: values.phone,
        email: values.email,
        cep: values.cep,
        logradouro: values.logradouro,
        numero: values.numero,
        complemento: values.complemento,
        bairro: values.bairro,
        cidade: values.cidade,
        uf: values.uf,
      };
      add(newRecipient);
      message.success("Destinatário adicionado.");
      setShowModal(false);
      return;
    }

    if (!editing?.id) {
      message.error("Selecione um destinatário para editar.");
      return;
    }

    update(editing.id, {
      name: values.name,
      doc: values.doc,
      phone: values.phone,
      email: values.email,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
    });

    message.success("Destinatário atualizado.");
    setShowModal(false);
    setEditing(null);
  };

  const handleDelete = (id: string, name: string) => {
    remove(id);
    message.success(`Destinatário "${name}" removido.`);
  };

  return (
    <Card
      title="Destinatários"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          Adicionar destinatário
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Input
          placeholder="Buscar por nome, CEP ou cidade..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />

        <List
          dataSource={filteredRecipients}
          locale={{ emptyText: "Você ainda não cadastrou destinatários." }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="edit" type="link" onClick={() => handleOpenEdit(item)}>
                  Editar
                </Button>,
                <Popconfirm
                  key="delete"
                  title={`Remover destinatário "${item.name}"?`}
                  description="Esta ação não pode ser desfeita."
                  okText="Remover"
                  cancelText="Cancelar"
                  onConfirm={() => handleDelete(item.id, item.name)}
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
                    <Typography.Text strong>{item.name}</Typography.Text>
                    {item.doc && (
                      <Typography.Text type="secondary">· {item.doc}</Typography.Text>
                    )}
                  </Space>
                }
                description={
                  <Typography.Text type="secondary">
                    {item.logradouro && item.numero
                      ? `${item.logradouro}, ${item.numero}`
                      : "Endereço incompleto"}
                    {item.complemento ? ` - ${item.complemento}` : ""}
                    {item.bairro ? ` · ${item.bairro}` : ""} · {item.cidade}/{item.uf} · CEP{" "}
                    {item.cep}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
        />
      </Space>

      <RecipientModal
        open={showModal}
        initialValues={editing}
        onSubmit={handleSubmit}
        onCancel={() => {
          setShowModal(false);
          setEditing(null);
        }}
      />
    </Card>
  );
}
