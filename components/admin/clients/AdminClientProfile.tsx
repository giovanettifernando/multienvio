"use client";

import { useState } from "react";
import {
  Form,
  Input,
  Button,
  Switch,
  Select,
  Space,
  message,
  Descriptions,
  Divider,
  Typography,
  Row,
  Col,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { maskCPF, maskCNPJ, maskPhone } from "@/lib/masks";

const { Text } = Typography;

interface AdminClientProfileProps {
  clientId: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf: string | null;
    cnpj: string | null;
    hasCompany: boolean;
    razaoSocial: string | null;
    status: string;
    emailVerified: boolean;
    authProvider: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
  };
  onUpdate: () => void;
}

export default function AdminClientProfile({
  clientId,
  user,
  onUpdate,
}: AdminClientProfileProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const payload = {
        name: values.name,
        email: values.email,
        phone: (values.phone as string)?.replace(/\D/g, "") || null,
        cpf: (values.cpf as string)?.replace(/\D/g, "") || null,
        hasCompany: values.hasCompany,
        cnpj: values.hasCompany ? (values.cnpj as string)?.replace(/\D/g, "") || null : null,
        razaoSocial: values.hasCompany ? values.razaoSocial || null : null,
        status: values.status,
        emailVerified: values.emailVerified,
      };

      const res = await fetch(`/api/admin/clients/${clientId}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erro ao atualizar perfil");
      }

      message.success("Perfil atualizado com sucesso");
      onUpdate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Erro ao atualizar perfil");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      {/* Info de auditoria */}
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2, md: 3 }}
        style={{ marginBottom: 24 }}
      >
        <Descriptions.Item label="ID do usuário">
          <Text copyable code>
            {user.id}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Provedor de autenticação">
          {user.authProvider === "email" ? "Email/Senha" : "Google"}
        </Descriptions.Item>
        <Descriptions.Item label="Criado em">
          {formatDate(user.createdAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Último login">
          {formatDate(user.lastLoginAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Atualizado em">
          {formatDate(user.updatedAt)}
        </Descriptions.Item>
      </Descriptions>

      <Divider>Dados do usuário</Divider>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: user.name,
          email: user.email,
          phone: user.phone ? maskPhone(user.phone) : "",
          cpf: user.cpf ? maskCPF(user.cpf) : "",
          hasCompany: user.hasCompany,
          cnpj: user.cnpj ? maskCNPJ(user.cnpj) : "",
          razaoSocial: user.razaoSocial || "",
          status: user.status,
          emailVerified: user.emailVerified,
        }}
        onFinish={handleSubmit}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label="Nome completo"
              rules={[{ required: true, message: "Nome é obrigatório" }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email é obrigatório" },
                { type: "email", message: "Email inválido" },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="phone" label="Telefone">
              <Input
                maxLength={15}
                onChange={(e) => {
                  const masked = maskPhone(e.target.value);
                  form.setFieldValue("phone", masked);
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="cpf" label="CPF">
              <Input
                maxLength={14}
                onChange={(e) => {
                  const masked = maskCPF(e.target.value);
                  form.setFieldValue("cpf", masked);
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="status" label="Status da conta">
              <Select>
                <Select.Option value="active">Ativo</Select.Option>
                <Select.Option value="pending">Pendente</Select.Option>
                <Select.Option value="blocked">Bloqueado</Select.Option>
                <Select.Option value="suspended">Suspenso</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item
              name="emailVerified"
              label="Email verificado"
              valuePropName="checked"
            >
              <Switch checkedChildren="Sim" unCheckedChildren="Não" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="hasCompany"
              label="Possui empresa (PJ)"
              valuePropName="checked"
            >
              <Switch checkedChildren="Sim" unCheckedChildren="Não" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item noStyle shouldUpdate={(prev, curr) => prev.hasCompany !== curr.hasCompany}>
          {({ getFieldValue }) =>
            getFieldValue("hasCompany") && (
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="cnpj" label="CNPJ">
                    <Input
                      maxLength={18}
                      onChange={(e) => {
                        const masked = maskCNPJ(e.target.value);
                        form.setFieldValue("cnpj", masked);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item name="razaoSocial" label="Razão Social">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            )
          }
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
              Salvar alterações
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
