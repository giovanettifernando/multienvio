"use client";

import { useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { maskCEP, maskCPF, maskPhone } from "@/lib/masks";

interface Recipient {
  id: string;
  name: string;
  email: string | null;
  document: string | null;
  phone: string | null;
  notes: string | null;
  isDefault: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}

interface AdminClientRecipientsProps {
  clientId: string;
  recipients: Recipient[];
  onUpdate: () => void;
}

export default function AdminClientRecipients({
  clientId,
  recipients,
  onUpdate,
}: AdminClientRecipientsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const openModal = (recipient?: Recipient) => {
    setEditingRecipient(recipient || null);
    if (recipient) {
      form.setFieldsValue({
        ...recipient,
        cep: maskCEP(recipient.cep),
        document: recipient.document ? maskCPF(recipient.document) : "",
        phone: recipient.phone ? maskPhone(recipient.phone) : "",
      });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRecipient(null);
    form.resetFields();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        cep: (values.cep as string).replace(/\D/g, ""),
        document: (values.document as string)?.replace(/\D/g, "") || null,
        phone: (values.phone as string)?.replace(/\D/g, "") || null,
        uf: (values.uf as string).toUpperCase(),
      };

      const url = editingRecipient
        ? `/api/admin/clients/${clientId}/recipients/${editingRecipient.id}`
        : `/api/admin/clients/${clientId}/recipients`;

      const res = await fetch(url, {
        method: editingRecipient ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao salvar destinatário");
      }

      message.success(editingRecipient ? "Destinatário atualizado" : "Destinatário criado");
      closeModal();
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recipientId: string) => {
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/recipients/${recipientId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao remover destinatário");
      }

      message.success("Destinatário removido");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao remover");
    }
  };

  const columns: ColumnsType<Recipient> = [
    {
      title: "Nome",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Space>
          {name}
          {record.isDefault && (
            <Tag icon={<StarOutlined />} color="gold">
              Padrão
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Contato",
      key: "contact",
      render: (_, record) => (
        <>
          {record.email && <div>{record.email}</div>}
          {record.phone && <small>{maskPhone(record.phone)}</small>}
        </>
      ),
    },
    {
      title: "Endereço",
      key: "address",
      render: (_, record) => (
        <>
          {record.cidade}/{record.uf}
          <br />
          <small>{maskCEP(record.cep)}</small>
        </>
      ),
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
            title="Remover destinatário?"
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
          Adicionar destinatário
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={recipients}
        rowKey="id"
        pagination={recipients.length > 10 ? { pageSize: 10 } : false}
        locale={{ emptyText: "Nenhum destinatário cadastrado" }}
      />

      <Modal
        title={editingRecipient ? "Editar destinatário" : "Novo destinatário"}
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Nome"
                rules={[{ required: true, message: "Nome é obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="document" label="CPF/CNPJ">
                <Input
                  maxLength={18}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const masked = val.length <= 11 ? maskCPF(val) : val;
                    form.setFieldValue("document", masked);
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="phone" label="Telefone">
                <Input
                  maxLength={15}
                  onChange={(e) => {
                    form.setFieldValue("phone", maskPhone(e.target.value));
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
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
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="numero"
                label="Número"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="complemento" label="Complemento">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="bairro"
                label="Bairro"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="cidade"
                label="Cidade"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="uf"
                label="UF"
                rules={[{ required: true, message: "Obrigatório" }]}
              >
                <Input maxLength={2} style={{ textTransform: "uppercase" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item name="notes" label="Observações">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isDefault" label="Destinatário padrão" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingRecipient ? "Salvar" : "Adicionar"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
