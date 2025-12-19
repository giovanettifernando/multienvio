'use client';

import { ELForm, ELInput, ELSelect, ELButton, useELApp, ELSpace } from '@/shared/ui';
const Form = ELForm;
const Input = ELInput;
const Select = ELSelect;
const Button = ELButton;
const App = { useApp: useELApp };
const Space = ELSpace;
import type { Priority } from '@/shared/validation/support';
import { useMutation } from '@tanstack/react-query';
import { useCollectorSession } from '@/modules/collectors/ui/state/useCollectorSession';

const { TextArea } = Input;

interface CollectorSupportFormProps {
  onSuccess?: (ticketId: string) => void;
}

interface FormValues {
  subject: string;
  priority: Priority;
  description: string;
}

export function CollectorSupportForm({ onSuccess }: CollectorSupportFormProps) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { collector } = useCollectorSession();

  const createTicket = useMutation({
    mutationFn: async (data: { subject: string; priority: Priority; description: string }) => {
      if (!collector) {
        throw new Error('Sessão do coletor não encontrada');
      }

      // Construir objeto requester a partir da sessão do coletor
      // Sanitizar CNPJ removendo pontuação para usar como email fallback
      const sanitizedCnpj = collector.cnpj.replace(/[^\d]/g, '');
      const requesterEmail = collector.email || `${sanitizedCnpj}@collector.temp`;

      const response = await fetch('/api/pontos-coleta/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: {
            name: collector.nomeFantasia,
            email: requesterEmail,
            phone: collector.telefone || null,
          },
          subject: data.subject,
          priority: data.priority,
          description: data.description,
          tags: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error?.message || errorData.message || 'Erro ao criar chamado');
      }

      const json = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      return json.data ?? json;
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      const ticket = await createTicket.mutateAsync(values);
      message.success('Chamado aberto com sucesso!');

      form.resetFields();

      if (onSuccess) {
        onSuccess(ticket.id);
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      const text = error instanceof Error ? error.message : 'Erro ao criar chamado';
      message.error(text);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        priority: 'media',
      }}
    >
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

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={createTicket.isPending}>
            Abrir chamado
          </Button>
          <Button onClick={() => form.resetFields()}>
            Limpar
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
