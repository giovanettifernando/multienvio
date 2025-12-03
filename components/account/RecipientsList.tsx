"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Input,
  List,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import {
  useAccountRecipients,
  useRecipientCreate,
  useRecipientDelete,
  useRecipientMakeDefault,
  useRecipientUpdate,
} from "@/hooks/useAccount";
import { useRecipientsStore } from "@/lib/state/recipients";
import type { Recipient } from "@/types/account";
import type { Recipient as StoreRecipient } from "@/lib/state/recipients";
import { RecipientModal, type RecipientFormValues } from "@/components/recipients/RecipientModal";

const PAGE_SIZE = 10;

function mapToStoreRecipients(items: Recipient[]): StoreRecipient[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    doc: item.document ?? undefined,
    phone: item.phone ?? undefined,
    email: item.email ?? undefined,
    notes: item.notes ?? undefined,
    cep: item.cep,
    logradouro: item.logradouro,
    numero: item.numero,
    complemento: item.complemento ?? undefined,
    bairro: item.bairro,
    cidade: item.cidade,
    uf: item.uf,
    isDefault: item.isDefault,
  }));
}

function formatPhoneForForm(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("+55") && value.length >= 5) {
    return value.replace(/^\+55/, "");
  }
  return value;
}

export default function RecipientsList() {
  const { message } = App.useApp();
  const setAll = useRecipientsStore((s) => s.setAll);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = PAGE_SIZE;

  const filters = useMemo(
    () => ({
      q: search.trim() || undefined,
      page,
      pageSize,
    }),
    [search, page, pageSize],
  );

  const recipientsQuery = useAccountRecipients(filters);

  const recipients: Recipient[] = useMemo(
    () => (recipientsQuery.data?.items ?? []) as Recipient[],
    [recipientsQuery.data],
  );
  const total = recipientsQuery.data?.total ?? 0;

  useEffect(() => {
    if (recipientsQuery.data) {
      setAll(mapToStoreRecipients(recipientsQuery.data.items as Recipient[]));
    }
  }, [recipientsQuery.data, setAll]);

  // Handler para busca que também reseta a página
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const createMutation = useRecipientCreate();
  const updateMutation = useRecipientUpdate();
  const deleteMutation = useRecipientDelete();
  const makeDefaultMutation = useRecipientMakeDefault();

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [showModal, setShowModal] = useState(false);

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
    const payload = {
      name: values.name,
      email: values.email?.trim() || undefined,
      document: values.doc?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento?.trim() || undefined,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
    };

    if (modalMode === "create") {
      createMutation.mutate(payload, {
        onSuccess: () => {
          message.success("Destinatário adicionado.");
          setShowModal(false);
        },
        onError: (error) => {
          message.error(error.message);
        },
      });
      return;
    }

    if (!editing) {
      message.error("Selecione um destinatário para editar.");
      return;
    }

    updateMutation.mutate(
      {
        id: editing.id,
        payload,
      },
      {
        onSuccess: () => {
          message.success("Destinatário atualizado.");
          setShowModal(false);
          setEditing(null);
        },
        onError: (error) => {
          message.error(error.message);
        },
      },
    );
  };

  const handleDelete = (recipient: Recipient) => {
    deleteMutation.mutate(recipient.id, {
      onSuccess: () => {
        message.success(`Destinatário "${recipient.name}" removido.`);
      },
      onError: (error) => {
        message.error(error.message);
      },
    });
  };

  const handleSetDefault = (recipient: Recipient) => {
    makeDefaultMutation.mutate(recipient.id, {
      onSuccess: () => {
        message.success("Destinatário definido como padrão.");
      },
      onError: (error) => {
        message.error(error.message);
      },
    });
  };

  const loadingList = recipientsQuery.isLoading;

  return (
    <Card
      title="Destinatários"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          Adicionar destinatário
        </Button>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Input
          placeholder="Buscar por nome, documento, cidade..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          allowClear
        />

        <List<Recipient>
          dataSource={recipients}
          loading={loadingList}
          locale={{ emptyText: "Você ainda não cadastrou destinatários." }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (nextPage) => setPage(nextPage),
            showSizeChanger: false,
          }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="edit" type="link" onClick={() => handleOpenEdit(item)}>
                  Editar
                </Button>,
                <Button
                  key="default"
                  type="link"
                  disabled={item.isDefault}
                  loading={
                    makeDefaultMutation.isPending &&
                    makeDefaultMutation.variables === item.id
                  }
                  onClick={() => handleSetDefault(item)}
                >
                  Definir como padrão
                </Button>,
                <Popconfirm
                  key="delete"
                  title={`Remover destinatário "${item.name}"?`}
                  description="Esta ação não pode ser desfeita."
                  okText="Remover"
                  cancelText="Cancelar"
                  onConfirm={() => handleDelete(item)}
                >
                  <Button
                    type="link"
                    danger
                    loading={
                      deleteMutation.isPending &&
                      deleteMutation.variables === item.id
                    }
                  >
                    Remover
                  </Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <Typography.Text strong>{item.name}</Typography.Text>
                    {item.document ? (
                      <Typography.Text type="secondary">· {item.document}</Typography.Text>
                    ) : null}
                    {item.isDefault ? <Tag color="gold">Padrão</Tag> : null}
                  </Space>
                }
                description={
                  <Space orientation="vertical" size={0}>
                    <Typography.Text type="secondary">
                      {item.logradouro}, {item.numero}
                      {item.complemento ? ` - ${item.complemento}` : ""} · {item.bairro}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {item.cidade}/{item.uf} · CEP {item.cep}
                    </Typography.Text>
                    {item.phone ? (
                      <Typography.Text type="secondary">Tel: {item.phone}</Typography.Text>
                    ) : null}
                    {item.email ? (
                      <Typography.Text type="secondary">E-mail: {item.email}</Typography.Text>
                    ) : null}
                    {item.notes ? (
                      <Typography.Text type="secondary">Observações: {item.notes}</Typography.Text>
                    ) : null}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Space>

      <RecipientModal
        open={showModal}
        loading={createMutation.isPending || updateMutation.isPending}
        initialValues={
          editing
            ? {
                id: editing.id,
                name: editing.name,
                doc: editing.document ?? undefined,
                phone: formatPhoneForForm(editing.phone),
                email: editing.email ?? undefined,
                notes: editing.notes ?? "",
                cep: editing.cep,
                logradouro: editing.logradouro,
                numero: editing.numero,
                complemento: editing.complemento ?? undefined,
                bairro: editing.bairro,
                cidade: editing.cidade,
                uf: editing.uf,
              }
            : null
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
