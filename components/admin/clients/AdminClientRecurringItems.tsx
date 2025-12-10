"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/lib/utils/format";
import type { ColumnsType } from "antd/es/table";
import { formatNumberBR } from "@/lib/format";

interface RecurringItem {
  id: string;
  descricao: string;
  valorUnitario: number;
}

interface AdminClientRecurringItemsProps {
  clientId: string;
  items: RecurringItem[];
  onUpdate: () => void;
}

export default function AdminClientRecurringItems({
  clientId,
  items,
  onUpdate,
}: AdminClientRecurringItemsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const openModal = (item?: RecurringItem) => {
    setEditingItem(item || null);
    if (item) {
      form.setFieldsValue(item);
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const url = editingItem
        ? `/api/admin/clients/${clientId}/recurring-items/${editingItem.id}`
        : `/api/admin/clients/${clientId}/recurring-items`;

      const res = await fetch(url, {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar item");
      }

      message.success(editingItem ? "Item atualizado" : "Item criado");
      closeModal();
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/recurring-items/${itemId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao remover item");
      }

      message.success("Item removido");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao remover");
    }
  };

  const columns: ColumnsType<RecurringItem> = [
    {
      title: "Descrição",
      dataIndex: "descricao",
      key: "descricao",
    },
    {
      title: "Valor Unitário",
      dataIndex: "valorUnitario",
      key: "valorUnitario",
      render: (value) => `R$ ${formatNumberBR(value)}`,
      align: "right",
    },
    {
      title: "Ações",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          />
          <Popconfirm
            title="Remover item?"
            description="Esta ação não pode ser desfeita."
            onConfirm={() => handleDelete(record.id)}
            okText="Remover"
            cancelText="Cancelar"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Adicionar item
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        pagination={items.length > 10 ? { pageSize: 10 } : false}
        locale={{ emptyText: "Nenhum item recorrente cadastrado" }}
      />

      <Modal
        title={editingItem ? "Editar item recorrente" : "Novo item recorrente"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="descricao"
            label="Descrição"
            rules={[{ required: true, message: "Descrição é obrigatória" }]}
          >
            <Input placeholder="Ex: Caixa de papelão 30x20x15" />
          </Form.Item>

          <Form.Item
            name="valorUnitario"
            label="Valor Unitário (R$)"
            rules={[{ required: true, message: "Valor é obrigatório" }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: "100%" }}
              prefix="R$"
              decimalSeparator=","
              formatter={inputNumberFormatterBRL}
              parser={inputNumberParserBRL}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingItem ? "Salvar" : "Adicionar"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
