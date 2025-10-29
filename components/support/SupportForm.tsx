'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Upload, App, Space, Alert } from 'antd';
import { PaperClipOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useCreateTicket } from '@/hooks/useSupport';
import { useSessionUser } from '@/stores/auth';
import { NewTicketInputSchema, type SupportAttachment, type Priority } from '@/lib/validation/support';

const { TextArea } = Input;

interface SupportFormProps {
  onSuccess?: (ticketId: string) => void;
  defaultValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface FormValues {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  priority: Priority;
  description: string;
}

export function SupportForm({ onSuccess, defaultValues }: SupportFormProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const createTicket = useCreateTicket();
  const usuario = useSessionUser();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-preencher dados do usuário logado
  useEffect(() => {
    if (!usuario) return;

    form.setFieldsValue({
      name: usuario.name || '',
      email: usuario.email || '',
      phone: usuario.phone || '',
    });
  }, [usuario, form]);

  const isLoggedIn = Boolean(usuario);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      // Convert file list to attachments (metadata only)
      const attachments: SupportAttachment[] = fileList.map(file => ({
        id: file.uid,
        name: file.name,
        size: file.size || 0,
        type: file.type || null,
        url: null, // No actual upload for now
      }));

      // Garantir que usamos os dados do usuário se estiver logado
      const input = NewTicketInputSchema.parse({
        requester: {
          name: usuario?.name || values.name,
          email: usuario?.email || values.email,
          phone: values.phone || usuario?.phone || null,
        },
        subject: values.subject,
        priority: values.priority as Priority,
        description: values.description,
        tags: [], // Campo removido da UI, sempre enviar array vazio
        attachments,
      });

      const ticket = createTicket(input);
      message.success('Chamado aberto com sucesso!');

      // Resetar apenas campos não relacionados ao usuário
      form.setFieldsValue({
        subject: '',
        description: '',
        priority: 'media',
      });
      setFileList([]);

      if (onSuccess) {
        onSuccess(ticket.id);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      message.error('Erro ao criar chamado. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isLoggedIn && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
          message="Entre na sua conta para auto-preencher seus dados."
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: defaultValues?.name || '',
          email: defaultValues?.email || '',
          phone: defaultValues?.phone || '',
          priority: 'media',
        }}
      >
        <Form.Item
          name="name"
          label="Nome"
          rules={[{ required: true, message: 'Nome é obrigatório' }]}
          tooltip={isLoggedIn ? 'Preenchido automaticamente da sua conta' : undefined}
        >
          <Input
            placeholder="Seu nome completo"
            readOnly={isLoggedIn}
            disabled={isLoggedIn}
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="E-mail"
          rules={[
            { required: true, message: 'E-mail é obrigatório' },
            { type: 'email', message: 'E-mail inválido' },
          ]}
          tooltip={isLoggedIn ? 'Preenchido automaticamente da sua conta' : undefined}
        >
          <Input
            placeholder="seu@email.com"
            readOnly={isLoggedIn}
            disabled={isLoggedIn}
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Telefone (opcional)"
          tooltip={!usuario?.phone ? 'Você pode adicionar seu telefone aqui' : undefined}
        >
          <Input placeholder="(00) 00000-0000" />
        </Form.Item>

      <Form.Item
        name="subject"
        label="Assunto"
        rules={[{ required: true, message: 'Assunto é obrigatório', min: 3 }]}
      >
        <Input placeholder="Descreva brevemente o problema" />
      </Form.Item>

      <Form.Item
        name="priority"
        label="Prioridade"
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { value: 'baixa', label: 'Baixa' },
            { value: 'media', label: 'Média' },
            { value: 'alta', label: 'Alta' },
            { value: 'critica', label: 'Crítica' },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="description"
        label="Descrição"
        rules={[{ required: true, message: 'Descrição é obrigatória', min: 3 }]}
      >
        <TextArea
          rows={4}
          placeholder="Descreva o problema em detalhes"
          showCount
          maxLength={1000}
        />
      </Form.Item>

      <Form.Item label="Anexos (opcional)">
        <Upload
          fileList={fileList}
          onChange={({ fileList: newFileList }) => setFileList(newFileList)}
          beforeUpload={() => false}
          maxCount={5}
        >
          <Button icon={<PaperClipOutlined />}>Adicionar arquivos</Button>
        </Upload>
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            Abrir chamado
          </Button>
          <Button onClick={() => {
            if (isLoggedIn) {
              // Se logado, resetar apenas campos não relacionados ao usuário
              form.setFieldsValue({
                subject: '',
                description: '',
                priority: 'media',
              });
            } else {
              // Se não logado, resetar tudo
              form.resetFields();
            }
            setFileList([]);
          }}>
            Limpar
          </Button>
        </Space>
      </Form.Item>
    </Form>
    </>
  );
}
