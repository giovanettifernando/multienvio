"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  theme,
} from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, StarOutlined, StarFilled, UploadOutlined, DownloadOutlined } from "@ant-design/icons";
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
  const { token } = theme.useToken();
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
  const [importing, setImporting] = useState(false);

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

  const handleDownloadTemplate = () => {
    const csvContent =
      "nome,documento,telefone,email,cep,logradouro,numero,complemento,bairro,cidade,uf,observacoes\n" +
      "João Silva,12345678901,11999998888,joao@email.com,01310100,Av Paulista,1000,Sala 101,Bela Vista,São Paulo,SP,Cliente VIP\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_destinatarios.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async (file: File) => {
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/account/recipients/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao importar CSV");
      }

      const result = await response.json();
      message.success(result.message);

      if (result.errors && result.errors.length > 0) {
        message.warning(`${result.errors.length} linha(s) com erro foram ignoradas`);
      }

      // Recarregar lista
      recipientsQuery.refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao importar CSV");
      console.error(error);
    } finally {
      setImporting(false);
    }

    return false; // Impede upload automático
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
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        {/* Botões de importação/exportação */}
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            Baixar Modelo
          </Button>
          <Upload
            accept=".csv"
            showUploadList={false}
            beforeUpload={handleImportCSV}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Importar Destinatários
            </Button>
          </Upload>
        </Space>

        {/* Campo de busca */}
        <Input
          placeholder="Buscar por nome, documento, cidade..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          allowClear
        />

        {loadingList ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin />
          </div>
        ) : recipients.length === 0 ? (
          <Empty description="Você ainda não cadastrou destinatários." />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: token.marginXS }}>
              {recipients.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: `${token.paddingSM}px 0`,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Space style={{ marginBottom: token.marginXS }}>
                      <Typography.Text strong>{item.name}</Typography.Text>
                      {item.document ? (
                        <Typography.Text type="secondary">· {item.document}</Typography.Text>
                      ) : null}
                      {item.isDefault ? <Tag color="gold">Padrão</Tag> : null}
                    </Space>
                    <div>
                      <Typography.Text type="secondary">
                        {item.logradouro}, {item.numero}
                        {item.complemento ? ` - ${item.complemento}` : ""} · {item.bairro}
                      </Typography.Text>
                      <br />
                      <Typography.Text type="secondary">
                        {item.cidade}/{item.uf} · CEP {item.cep}
                      </Typography.Text>
                      {item.phone ? (
                        <>
                          <br />
                          <Typography.Text type="secondary">Tel: {item.phone}</Typography.Text>
                        </>
                      ) : null}
                      {item.email ? (
                        <>
                          <br />
                          <Typography.Text type="secondary">E-mail: {item.email}</Typography.Text>
                        </>
                      ) : null}
                      {item.notes ? (
                        <>
                          <br />
                          <Typography.Text type="secondary">Observações: {item.notes}</Typography.Text>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Space orientation="vertical" size={0} style={{ alignItems: "flex-end" }}>
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(item)}>
                      Editar
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      icon={item.isDefault ? <StarFilled style={{ color: "#faad14" }} /> : <StarOutlined />}
                      disabled={item.isDefault}
                      loading={
                        makeDefaultMutation.isPending &&
                        makeDefaultMutation.variables === item.id
                      }
                      onClick={() => handleSetDefault(item)}
                    >
                      {item.isDefault ? "Padrão" : "Definir como padrão"}
                    </Button>
                    <Popconfirm
                      title={`Remover destinatário "${item.name}"?`}
                      description="Esta ação não pode ser desfeita."
                      okText="Remover"
                      cancelText="Cancelar"
                      onConfirm={() => handleDelete(item)}
                    >
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        loading={
                          deleteMutation.isPending &&
                          deleteMutation.variables === item.id
                        }
                      >
                        Remover
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </div>
            {total > pageSize && (
              <div style={{ marginTop: token.marginMD, textAlign: "right" }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  onChange={(nextPage) => setPage(nextPage)}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
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
