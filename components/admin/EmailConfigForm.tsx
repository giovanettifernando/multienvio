'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Space, message, Spin, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';

interface EmailConfigFormData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

export default function EmailConfigForm() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-config');
      if (!res.ok) throw new Error('Erro ao carregar configuração');

      const data = await res.json();

      if (data.config) {
        form.setFieldsValue({
          host: data.config.host || '',
          port: data.config.port || 587,
          secure: data.config.secure || false,
          user: data.config.user || '',
          password: '', // Não retornamos a senha por segurança
          fromAddress: data.config.fromAddress || '',
          fromName: data.config.fromName || '',
        });
      }
    } catch {
      message.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const onFinish = async (values: EmailConfigFormData) => {
    setSaving(true);
    try {
      // Remover password se estiver vazio (não alterar)
      const payload: Partial<EmailConfigFormData> = {
        host: values.host,
        port: values.port,
        secure: values.secure,
        user: values.user,
        fromAddress: values.fromAddress,
        fromName: values.fromName,
      };

      if (values.password) {
        payload.password = values.password;
      }

      const res = await fetch('/api/admin/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar');
      }

      message.success('Configuração salva com sucesso!');

      // Limpar campo de senha após salvar
      form.setFieldsValue({
        password: '',
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Configuração de Email (SMTP)"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadConfig}
            loading={loading}
          >
            Recarregar
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
          >
            Salvar
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Alert
          message="Servidor SMTP"
          description="Configure o servidor SMTP para envio de emails. As credenciais são criptografadas antes de serem salvas no banco de dados. Para sua segurança, o campo de senha fica vazio após salvar."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            port: 587,
            secure: false,
          }}
        >
          <Form.Item
            label="Host SMTP"
            name="host"
            rules={[{ required: true, message: 'Host SMTP é obrigatório' }]}
            tooltip="Servidor SMTP (ex: smtp.gmail.com, smtp.office365.com)"
          >
            <Input
              placeholder="smtp.gmail.com"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Porta"
            name="port"
            rules={[{ required: true, message: 'Porta é obrigatória' }]}
            tooltip="Porta SMTP (587 para TLS, 465 para SSL, 25 sem criptografia)"
          >
            <InputNumber
              min={1}
              max={65535}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="Conexão Segura (SSL/TLS)"
            name="secure"
            valuePropName="checked"
            tooltip="Ative para porta 465 (SSL). Desative para porta 587 (TLS/STARTTLS)"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Usuário (Email)"
            name="user"
            rules={[
              { required: true, message: 'Email é obrigatório' },
              { type: 'email', message: 'Email inválido' },
            ]}
            tooltip="Email completo usado para autenticação SMTP"
          >
            <Input
              type="email"
              placeholder="seu-email@dominio.com"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Senha"
            name="password"
            tooltip="Senha do email ou App Password. Deixe vazio para não alterar."
          >
            <Input.Password
              placeholder="Deixe vazio para não alterar"
              style={{ fontFamily: 'monospace' }}
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label="Email Remetente"
            name="fromAddress"
            rules={[
              { required: true, message: 'Email remetente é obrigatório' },
              { type: 'email', message: 'Email inválido' },
            ]}
            tooltip="Email que aparecerá como remetente nas mensagens"
          >
            <Input
              type="email"
              placeholder="noreply@seudominio.com"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Nome Remetente"
            name="fromName"
            rules={[{ required: true, message: 'Nome remetente é obrigatório' }]}
            tooltip="Nome que aparecerá como remetente nas mensagens"
          >
            <Input placeholder="Envio Legal" />
          </Form.Item>

          <Alert
            message="Configuração Comum de Provedores"
            description={
              <div>
                <p style={{ marginBottom: 8 }}><strong>Gmail:</strong></p>
                <ul style={{ marginBottom: 8, paddingLeft: 20 }}>
                  <li>Host: smtp.gmail.com</li>
                  <li>Porta: 587</li>
                  <li>Secure: Desativado</li>
                  <li>Senha: Use App Password (não a senha da conta)</li>
                </ul>
                <p style={{ marginBottom: 8 }}><strong>Office 365:</strong></p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>Host: smtp.office365.com</li>
                  <li>Porta: 587</li>
                  <li>Secure: Desativado</li>
                </ul>
              </div>
            }
            type="warning"
            showIcon
          />
        </Form>
      </Spin>
    </Card>
  );
}
