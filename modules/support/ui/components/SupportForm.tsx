'use client';

import { useEffect } from 'react';
import { Form, App, Space, Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { ELButton } from '@/shared/ui/ELButton';
import { useCreateTicket } from '@/hooks/useSupport';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCollectorSession } from '@/modules/collectors/ui/state/useCollectorSession';
import { NewTicketInputSchema, type Priority } from '@/shared/validation/support';

type Audience = 'user' | 'admin' | 'collector';

interface SupportFormProps {
  onSuccess?: (ticketId: string) => void;
  audience?: Audience;
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

export function SupportForm({ onSuccess, audience = 'user', defaultValues }: SupportFormProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const createTicket = useCreateTicket(audience);
  const { user: usuario } = useCurrentUser();
  const { collector } = useCollectorSession();

  // Auto-preencher dados do usuário ou coletor logado
  useEffect(() => {
    if (audience === 'collector' && collector) {
      form.setFieldsValue({
        name: collector.nomeFantasia || '',
        email: collector.email || '',
        phone: collector.telefone || '',
      });
    } else if (audience === 'user' && usuario) {
      form.setFieldsValue({
        name: usuario.name || '',
        email: usuario.email || '',
        phone: usuario.phone || '',
      });
    }
  }, [usuario, collector, audience, form]);

  const isLoggedIn = audience === 'collector' ? Boolean(collector) : Boolean(usuario);

  const handleSubmit = async (values: FormValues) => {
    try {
      // Garantir que usamos os dados do usuário/coletor se estiver logado
      let requesterName: string;
      let requesterEmail: string;
      let requesterPhone: string | null;

      if (audience === 'collector' && collector) {
        requesterName = collector.nomeFantasia || values.name;
        requesterEmail = collector.email || values.email;
        requesterPhone = values.phone || collector.telefone || null;
      } else if (audience === 'user' && usuario) {
        requesterName = usuario.name || values.name;
        requesterEmail = usuario.email || values.email;
        requesterPhone = values.phone || usuario.phone || null;
      } else {
        requesterName = values.name;
        requesterEmail = values.email;
        requesterPhone = values.phone || null;
      }

      const input = NewTicketInputSchema.parse({
        requester: {
          name: requesterName,
          email: requesterEmail,
          phone: requesterPhone,
        },
        subject: values.subject,
        priority: values.priority as Priority,
        description: values.description,
        tags: [],
        attachments: [], // Upload de anexos disponível apenas ao adicionar comentários
      });

      const ticket = await createTicket.mutateAsync(input);
      message.success('Chamado aberto com sucesso!');

      // Resetar apenas campos não relacionados ao usuário
      form.setFieldsValue({
        subject: '',
        description: '',
        priority: 'media',
      });

      if (onSuccess) {
        onSuccess(ticket.id);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      const text = error instanceof Error ? error.message : 'Erro ao criar chamado. Verifique os dados e tente novamente.';
      message.error(text);
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
          <ELInput
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
          <ELInput
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
          <ELInput placeholder="(00) 00000-0000" />
        </Form.Item>

      <Form.Item
        name="subject"
        label="Assunto"
        rules={[{ required: true, message: 'Assunto é obrigatório', min: 3 }]}
      >
        <ELInput placeholder="Descreva brevemente o problema" />
      </Form.Item>

      <Form.Item
        name="priority"
        label="Prioridade"
        rules={[{ required: true }]}
      >
        <ELSelect
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
        <ELInput.TextArea
          placeholder="Descreva o problema em detalhes"
          showCount
          maxLength={1000}
          autoSize={{ minRows: 6, maxRows: 12 }}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <ELButton variant="primary" htmlType="submit" loading={createTicket.isPending}>
            Abrir chamado
          </ELButton>
          <ELButton onClick={() => {
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
          }}>
            Limpar
          </ELButton>
        </Space>
      </Form.Item>
    </Form>
    </>
  );
}
