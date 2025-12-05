"use client";

import { useState, useEffect, useCallback } from "react";
import { App, Button, Table, Input, InputNumber, Popconfirm, Upload, Space, Flex } from "antd";
import { DeleteOutlined, PlusOutlined, UploadOutlined, DownloadOutlined, EditOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";

interface RecurringItem {
  id: string;
  descricao: string;
  valorUnitario: number;
}

export default function RecurringItemsList() {
  const { message } = App.useApp();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ descricao: string; valorUnitario: number | null }>({
    descricao: "",
    valorUnitario: null,
  });
  const [newItem, setNewItem] = useState<{ descricao: string; valorUnitario: number | null }>({
    descricao: "",
    valorUnitario: null,
  });

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/recurring-items");

      if (!response.ok) throw new Error("Erro ao carregar itens");

      const result = await response.json();
      setItems(result.data);
    } catch (error) {
      message.error("Não foi possível carregar os itens");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [message]);

  // Carregar itens ao montar o componente
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleAdd = async () => {
    if (!newItem.descricao.trim() || newItem.valorUnitario === null) {
      message.warning("Preencha descrição e valor unitário");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/recurring-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: newItem.descricao.trim(),
          valorUnitario: newItem.valorUnitario,
        }),
      });

      if (!response.ok) throw new Error("Erro ao salvar item");

      const result = await response.json();
      setItems([...items, result.data]);
      setNewItem({ descricao: "", valorUnitario: null });
      message.success("Item adicionado com sucesso");
    } catch (error) {
      message.error("Não foi possível adicionar o item");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/recurring-items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir item");

      setItems(items.filter((item) => item.id !== id));
      message.success("Item excluído com sucesso");
    } catch (error) {
      message.error("Não foi possível excluir o item");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: RecurringItem) => {
    setEditingId(record.id);
    setEditingItem({
      descricao: record.descricao,
      valorUnitario: record.valorUnitario,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingItem({ descricao: "", valorUnitario: null });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingItem.descricao.trim() || editingItem.valorUnitario === null) {
      message.warning("Preencha descrição e valor unitário");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/recurring-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: editingItem.descricao.trim(),
          valorUnitario: editingItem.valorUnitario,
        }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar item");

      const result = await response.json();
      setItems(items.map((item) => (item.id === id ? result.data : item)));
      setEditingId(null);
      setEditingItem({ descricao: "", valorUnitario: null });
      message.success("Item atualizado com sucesso");
    } catch (error) {
      message.error("Não foi possível atualizar o item");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = async (file: File) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/recurring-items/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao importar CSV");

      const result = await response.json();
      setItems(result.data);
      message.success(`${result.data.length} itens importados com sucesso`);
    } catch (error) {
      message.error("Não foi possível importar o CSV");
      console.error(error);
    } finally {
      setLoading(false);
    }

    return false; // Impede upload automático
  };

  const handleDownloadTemplate = () => {
    const csvContent = "descricao,valorUnitario\nExemplo de item,99.90\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_itens_recorrentes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Descrição",
      dataIndex: "descricao",
      key: "descricao",
      width: "55%",
      render: (value: string, record: RecurringItem) => {
        if (editingId === record.id) {
          return (
            <Input
              value={editingItem.descricao}
              onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })}
              placeholder="Descrição do item"
            />
          );
        }
        return value;
      },
    },
    {
      title: "Valor Unitário (R$)",
      dataIndex: "valorUnitario",
      key: "valorUnitario",
      width: "25%",
      render: (value: number, record: RecurringItem) => {
        if (editingId === record.id) {
          return (
            <InputNumber
              value={editingItem.valorUnitario}
              onChange={(val) => setEditingItem({ ...editingItem, valorUnitario: val })}
              style={{ width: "100%" }}
              min={0}
              precision={2}
              decimalSeparator=","
              formatter={(val) => `R$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(val) => parseFloat(val?.replace(/R\$\s?|(,*)/g, "") || "0")}
            />
          );
        }
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
    {
      title: "Ações",
      key: "actions",
      width: "20%",
      render: (_: unknown, record: RecurringItem) => {
        if (editingId === record.id) {
          return (
            <Space>
              <Button
                type="link"
                icon={<SaveOutlined />}
                onClick={() => handleSaveEdit(record.id)}
                size="small"
              >
                Salvar
              </Button>
              <Button
                type="link"
                icon={<CloseOutlined />}
                onClick={handleCancelEdit}
                size="small"
              >
                Cancelar
              </Button>
            </Space>
          );
        }
        return (
          <Space>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              size="small"
            />
            <Popconfirm
              title="Excluir este item?"
              onConfirm={() => handleDelete(record.id)}
              okText="Sim"
              cancelText="Não"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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
          <Button icon={<UploadOutlined />} loading={loading}>
            Importar Itens
          </Button>
        </Upload>
      </Space>

      {/* Formulário de cadastro */}
      <Space.Compact style={{ width: "100%" }}>
        <Input
          placeholder="Descrição do item"
          value={newItem.descricao}
          onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
          style={{ flex: 1 }}
          onPressEnter={handleAdd}
        />
        <InputNumber
          placeholder="Valor unitário (R$)"
          value={newItem.valorUnitario}
          onChange={(value) => setNewItem({ ...newItem, valorUnitario: value })}
          style={{ width: 200 }}
          min={0}
          precision={2}
          decimalSeparator=","
          formatter={(value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
          parser={(value) => parseFloat(value?.replace(/R\$\s?|(,*)/g, "") || "0")}
          onPressEnter={handleAdd}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          loading={loading}
        >
          Adicionar
        </Button>
      </Space.Compact>

      {/* Grid de itens */}
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        locale={{
          emptyText: "Nenhum item cadastrado",
        }}
      />
    </Space>
  );
}
