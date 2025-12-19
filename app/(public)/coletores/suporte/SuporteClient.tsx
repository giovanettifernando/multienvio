'use client';

import { useState, useEffect } from 'react';
import {
  ELSpace,
  ELForm,
  useELApp,
  ELTable,
  ELTag,
  ELTypography,
  ELButton,
  ELCard,
  ELInput,
  ELModal,
  ELSelect,
  ELTabs,
} from '@/shared/ui';
const Space = ELSpace;
const Form = ELForm;
const App = { useApp: useELApp };
const Table = ELTable;
const Tag = ELTag;
const Typography = ELTypography;
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { PageShell } from '@/shared/ui/PageShell';
import { useTickets, useCreateTicket } from '@/modules/support/ui/hooks';
import type { Status, Priority } from '@/shared/validation/support';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import { useColetorSession } from '@/modules/collectors/ui/state/useColetorSession';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { Text } = Typography;

const statusColors: Record<Status, string> = {
  aberto: 'blue',
  em_atendimento: 'orange',
  resolvido: 'green',
  fechado: 'default',
};

const statusLabels: Record<Status, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

const priorityColors: Record<Priority, string> = {
  baixa: 'default',
  media: 'blue',
  alta: 'orange',
  critica: 'red',
};

const priorityLabels: Record<Priority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

interface TicketFormValues {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  priority: Priority;
  description: string;
}

export default function SuporteClient() {
  const { message } = App.useApp();
  const { coletor } = useColetorSession();
  const [form] = Form.useForm<TicketFormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<Priority[]>([]);

  const ticketsQuery = useTickets({
    audience: 'autonomous_collector',
    filters: {
      query,
      status: statusFilter.length > 0 ? statusFilter : undefined,
      priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    },
  });

  const createTicket = useCreateTicket('autonomous_collector');

  // Effect to populate form when modal opens and coletor data is available
  useEffect(() => {
    if (modalOpen && coletor) {
      console.log('[SUPORTE] Preenchendo formulário com dados do coletor:', {
        nome: coletor.pfNome,
        email: coletor.pfEmail,
        celular: coletor.pfCelular,
      });
      form.setFieldsValue({
        name: coletor.pfNome || '',
        email: coletor.pfEmail || '',
        phone: coletor.pfCelular || '',
        priority: 'media',
      });
    }
  }, [modalOpen, coletor, form]);

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    form.resetFields();
    setModalOpen(false);
  };

  const handleSubmit = async (values: TicketFormValues) => {
    try {
      await createTicket.mutateAsync({
        requester: {
          name: coletor?.pfNome || values.name,
          email: coletor?.pfEmail || values.email,
          phone: values.phone || coletor?.pfCelular || null,
        },
        subject: values.subject,
        priority: values.priority,
        description: values.description,
        tags: [],
        // Upload de anexos não implementado - aguardando configuração de storage
        attachments: [],
      });

      message.success('Chamado aberto com sucesso!');
      handleCloseModal();
    } catch (error) {
      console.error('Error creating ticket:', error);
      const text = error instanceof Error ? error.message : 'Erro ao criar chamado';
      message.error(text);
    }
  };

  const tickets = ticketsQuery.data?.tickets ?? [];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {id.slice(0, 8)}
        </Text>
      ),
    },
    {
      title: 'Assunto',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: Status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: 'Prioridade',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      render: (priority: Priority) => (
        <Tag color={priorityColors[priority]}>{priorityLabels[priority]}</Tag>
      ),
    },
    {
      title: 'Atualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (date: string) => (
        <Text type="secondary">{dayjs(date).fromNow()}</Text>
      ),
    },
  ];

  return (
    <PageShell title="Suporte" gap="md">
      <ELCard>
        <ELTabs
          defaultActiveKey="tickets"
          items={[
            {
              key: 'tickets',
              label: 'Meus Chamados',
              children: (
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  {/* Filtros */}
                  <Space wrap>
                    <ELInput
                      placeholder="Buscar..."
                      prefix={<SearchOutlined />}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{ width: 250 }}
                      allowClear
                    />
                    <ELSelect
                      mode="multiple"
                      placeholder="Status"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      style={{ minWidth: 180 }}
                      options={[
                        { label: 'Aberto', value: 'aberto' },
                        { label: 'Em Atendimento', value: 'em_atendimento' },
                        { label: 'Resolvido', value: 'resolvido' },
                        { label: 'Fechado', value: 'fechado' },
                      ]}
                      allowClear
                    />
                    <ELSelect
                      mode="multiple"
                      placeholder="Prioridade"
                      value={priorityFilter}
                      onChange={setPriorityFilter}
                      style={{ minWidth: 150 }}
                      options={[
                        { label: 'Baixa', value: 'baixa' },
                        { label: 'Média', value: 'media' },
                        { label: 'Alta', value: 'alta' },
                        { label: 'Crítica', value: 'critica' },
                      ]}
                      allowClear
                    />
                    <ELButton
                      icon={<ReloadOutlined />}
                      onClick={() => ticketsQuery.refetch()}
                      loading={ticketsQuery.isFetching}
                    >
                      Atualizar
                    </ELButton>
                    <ELButton
                      variant="primary"
                      icon={<PlusOutlined />}
                      onClick={handleOpenModal}
                    >
                      Novo Chamado
                    </ELButton>
                  </Space>

                  {/* Tabela de tickets */}
                  <Table
                    columns={columns}
                    dataSource={tickets}
                    rowKey="id"
                    loading={ticketsQuery.isLoading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total) => `Total: ${total} chamados`,
                    }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </ELCard>

      {/* Modal de Novo Chamado */}
      <ELModal
        title="Abrir Novo Chamado"
        open={modalOpen}
        onCancel={handleCloseModal}
        footer={null}
        size="md"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            priority: 'media',
          }}
        >
          <Form.Item
            name="name"
            label="Nome"
            rules={[{ required: true, message: 'Nome é obrigatório' }]}
          >
            <ELInput placeholder="Seu nome completo" disabled={!!coletor?.pfNome} />
          </Form.Item>

          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: 'E-mail é obrigatório' },
              { type: 'email', message: 'E-mail inválido' },
            ]}
          >
            <ELInput
              placeholder="seu@email.com"
              disabled={!!coletor?.pfEmail}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Telefone (opcional)"
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
              rows={4}
              placeholder="Descreva o problema em detalhes"
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <ELButton onClick={handleCloseModal}>
                Cancelar
              </ELButton>
              <ELButton variant="primary" htmlType="submit" loading={createTicket.isPending}>
                Abrir chamado
              </ELButton>
            </Space>
          </Form.Item>
        </Form>
      </ELModal>
    </PageShell>
  );
}
