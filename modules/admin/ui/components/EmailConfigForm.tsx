'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Form, Input, InputNumber, Switch, Button, Space, App, Spin, Alert } from 'antd';
import { ELModal } from '@/shared/ui/ELModal';
import { SaveOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';

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
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailModalVisible, setTestEmailModalVisible] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-config?reveal=true', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar configuração');

      const json = await res.json();
      const data = json.data ?? json;

      if (data.config) {
        form.setFieldsValue({
          host: data.config.host || '',
          port: data.config.port || 587,
          secure: data.config.secure || false,
          user: data.config.user || '',
          password: data.config.password || '',
          fromAddress: data.config.fromAddress || '',
          fromName: data.config.fromName || '',
        });
      }
    } catch {
      message.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

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
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao salvar');
      }

      message.success('Configuração salva com sucesso!');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const values = form.getFieldsValue();

      // Validar campos obrigatórios
      if (!values.host || !values.port || !values.user) {
        message.warning('Preencha os campos obrigatórios antes de testar');
        return;
      }

      const payload = {
        host: values.host,
        port: values.port,
        secure: values.secure,
        user: values.user,
        password: values.password || undefined,
      };

      const res = await fetch('/api/admin/email-config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao testar conexão');
      }

      message.success('Conexão SMTP testada com sucesso!');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      message.warning('Digite um email para enviar o teste');
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch('/api/admin/email-config/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to: testEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar email');
      }

      message.success(`Email de teste enviado para ${testEmail}!`);
      setTestEmailModalVisible(false);
      setTestEmail('');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao enviar email de teste');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      <Card
        title="Configuração de Email (SMTP)"
        extra={
          <Space>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={handleTestConnection}
              loading={testing}
              disabled={loading}
            >
              Testar Conexão
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={() => setTestEmailModalVisible(true)}
              disabled={loading}
            >
              Enviar Email de Teste
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
            description="Configure o servidor SMTP para envio de emails. As credenciais são criptografadas antes de serem salvas no banco de dados."
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
              tooltip="Senha do email ou App Password"
            >
              <Input
                placeholder="Senha ou App Password"
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
              <Input placeholder="Multienvio" />
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

      <ELModal
        title="Enviar Email de Teste"
        open={testEmailModalVisible}
        onOk={handleSendTestEmail}
        onCancel={() => {
          setTestEmailModalVisible(false);
          setTestEmail('');
        }}
        confirmLoading={sendingTest}
        okText="Enviar"
        cancelText="Cancelar"
        size="sm"
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Alert
            message="Email de Teste"
            description="Um email de teste será enviado usando a configuração SMTP atual. Certifique-se de que a configuração foi salva antes de enviar."
            type="info"
            showIcon
          />
          <Input
            placeholder="email@exemplo.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            type="email"
            style={{ marginTop: 16 }}
          />
        </Space>
      </ELModal>
    </>
  );
}
