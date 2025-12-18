"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Row,
  Col,
} from "antd";
import { ELModal } from '@/shared/ui/ELModal';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { TableProps } from 'antd';
import { maskCEP } from "@/shared/utils/masks";

interface Address {
  id: string;
  label: string | null;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  isDefault: boolean;
}

interface AdminClientAddressesProps {
  clientId: string;
  addresses: Address[];
  onUpdate: () => void;
}

export default function AdminClientAddresses({
  clientId,
  addresses,
  onUpdate,
}: AdminClientAddressesProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const openModal = (address?: Address) => {
    setEditingAddress(address || null);
    if (address) {
      form.setFieldsValue({
        ...address,
        cep: maskCEP(address.cep),
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAddress(null);
    form.resetFields();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        cep: (values.cep as string).replace(/\D/g, ""),
        uf: (values.uf as string).toUpperCase(),
      };

      const url = editingAddress
        ? `/api/admin/clients/${clientId}/addresses/${editingAddress.id}`
        : `/api/admin/clients/${clientId}/addresses`;

      const res = await fetch(url, {
        method: editingAddress ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar endereço");
      }

      message.success(editingAddress ? "Endereço atualizado" : "Endereço criado");
      closeModal();
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/addresses/${addressId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao remover endereço");
      }

      message.success("Endereço removido");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao remover");
    }
  };

  const columns: TableProps<Address>['columns'] = [
    {
      title: "Apelido",
      dataIndex: "label",
      key: "label",
      render: (label, record) => (
        <Space>
          {label || "-"}
          {record.isDefault && (
            <Tag icon={<StarOutlined />} color="gold">
              Padrão
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Endereço",
      key: "address",
      render: (_, record) => (
        <>
          {record.logradouro}, {record.numero}
          {record.complemento && ` - ${record.complemento}`}
          <br />
          <small>
            {record.bairro} - {record.cidade}/{record.uf}
          </small>
        </>
      ),
    },
    {
      title: "CEP",
      dataIndex: "cep",
      key: "cep",
      render: (cep) => maskCEP(cep),
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
            title="Remover endereço?"
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
          Adicionar endereço
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={addresses}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: "Nenhum endereço cadastrado" }}
      />

      <ELModal
        title={editingAddress ? "Editar endereço" : "Novo endereço"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        size="md"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="label" label="Apelido (opcional)">
                <Input placeholder="Ex: Casa, Trabalho" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="cep"
                label="CEP"
                rules={[{ required: true, message: "CEP é obrigatório" }]}
              >
                <Input
                  maxLength={9}
                  onChange={(e) => {
                    form.setFieldValue("cep", maskCEP(e.target.value));
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="logradouro"
                label="Logradouro"
                rules={[{ required: true, message: "Logradouro é obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="numero"
                label="Número"
                rules={[{ required: true, message: "Número é obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="complemento" label="Complemento">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="bairro"
                label="Bairro"
                rules={[{ required: true, message: "Bairro é obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="cidade"
                label="Cidade"
                rules={[{ required: true, message: "Cidade é obrigatória" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="uf"
                label="UF"
                rules={[{ required: true, message: "UF é obrigatório" }]}
              >
                <Input maxLength={2} style={{ textTransform: "uppercase" }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isDefault" label="Endereço padrão" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingAddress ? "Salvar" : "Adicionar"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </ELModal>
    </>
  );
}
