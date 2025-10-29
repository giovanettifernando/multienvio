'use client';

import { Drawer, Descriptions, Tag, Timeline, Input, Button, Space, Typography, Select, App, Divider, Empty } from 'antd';
import { SendOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useTicket } from '@/hooks/useSupport';
import { newMessage } from '@/lib/validation/support';
import type { Status, Priority, AuthorRole } from '@/lib/validation/support';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { TextArea } = Input;
const { Text, Title } = Typography;

interface TicketDetailsDrawerProps {
  ticketId: string | null;
  open: boolean;
  onClose: () => void;
  userRole?: AuthorRole;
  userName?: string;
}

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

export function TicketDetailsDrawer({
  ticketId,
  open,
  onClose,
  userRole = 'cliente',
  userName = 'Usuário'
}: TicketDetailsDrawerProps) {
  const { ticket, addMessage, setStatus, assign, addTag, removeTag } = useTicket(ticketId);
  const { message } = App.useApp();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setMessageText('');
    }
  }, [open]);

  if (!ticket) {
    return (
      <Drawer
        title="Detalhes do Chamado"
        open={open}
        onClose={onClose}
        width={600}
      >
        <Empty description="Chamado não encontrado" />
      </Drawer>
    );
  }

  const handleSendMessage = async () => {
    if (!messageText.trim() || !ticketId) return;

    setSending(true);
    try {
      const msg = newMessage({
        authorRole: userRole,
        authorName: userName,
        text: messageText,
      });

      addMessage(ticketId, msg);
      setMessageText('');
      message.success('Mensagem enviada');
    } catch (error) {
      message.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = (newStatus: Status) => {
    if (!ticketId) return;
    setStatus(ticketId, newStatus);
    message.success('Status atualizado');
  };

  const handleAssign = (assignedTo: string | null) => {
    if (!ticketId) return;
    assign(ticketId, assignedTo);
    message.success(assignedTo ? 'Chamado atribuído' : 'Atribuição removida');
  };

  return (
    <Drawer
      title={`Chamado #${ticket.id.slice(0, 8)}`}
      open={open}
      onClose={onClose}
      width={700}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header Info */}
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>{ticket.subject}</Title>
          <Space wrap>
            <Tag color={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Tag>
            <Tag color={priorityColors[ticket.priority]}>{priorityLabels[ticket.priority]}</Tag>
            {ticket.tags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        </div>

        {/* Admin Controls */}
        {userRole === 'admin' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Select
                value={ticket.status}
                onChange={handleStatusChange}
                style={{ width: 180 }}
                options={[
                  { value: 'aberto', label: 'Aberto' },
                  { value: 'em_atendimento', label: 'Em Atendimento' },
                  { value: 'resolvido', label: 'Resolvido' },
                  { value: 'fechado', label: 'Fechado' },
                ]}
              />
              <Select
                value={ticket.assignedTo || undefined}
                placeholder="Atribuir a..."
                onChange={handleAssign}
                allowClear
                style={{ width: 200 }}
                options={[
                  { value: 'admin1', label: 'Admin 1' },
                  { value: 'admin2', label: 'Admin 2' },
                  { value: 'admin3', label: 'Admin 3' },
                ]}
              />
            </Space>
          </Space>
        )}

        {/* Ticket Details */}
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Solicitante">
            <Space direction="vertical" size={0}>
              <Text strong>{ticket.requester.name}</Text>
              <Text type="secondary">{ticket.requester.email}</Text>
              {ticket.requester.phone && (
                <Text type="secondary">{ticket.requester.phone}</Text>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Descrição">
            {ticket.description}
          </Descriptions.Item>
          <Descriptions.Item label="Criado em">
            {dayjs(ticket.createdAt).format('DD/MM/YYYY HH:mm')} ({dayjs(ticket.createdAt).fromNow()})
          </Descriptions.Item>
          <Descriptions.Item label="Última atualização">
            {dayjs(ticket.updatedAt).format('DD/MM/YYYY HH:mm')} ({dayjs(ticket.updatedAt).fromNow()})
          </Descriptions.Item>
          {ticket.assignedTo && (
            <Descriptions.Item label="Atribuído a">
              <Tag icon={<UserOutlined />}>{ticket.assignedTo}</Tag>
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider />

        {/* Timeline */}
        <div>
          <Title level={5}>Histórico de Mensagens</Title>
          {ticket.messages.length === 0 ? (
            <Empty description="Nenhuma mensagem ainda" />
          ) : (
            <Timeline
              items={ticket.messages.map((msg) => ({
                key: msg.id,
                color: msg.authorRole === 'admin' ? 'blue' : 'green',
                children: (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <Text strong>
                        {msg.authorRole === 'admin' ? '🔧' : '👤'} {msg.authorName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(msg.at).format('DD/MM HH:mm')}
                      </Text>
                    </Space>
                    <Text>{msg.text}</Text>
                  </Space>
                ),
              }))}
            />
          )}
        </div>

        {/* Reply Box */}
        <div>
          <Title level={5}>Responder</Title>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite sua mensagem..."
              rows={3}
              maxLength={1000}
              showCount
              onPressEnter={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  handleSendMessage();
                }
              }}
            />
          </Space.Compact>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={sending}
            disabled={!messageText.trim()}
            style={{ marginTop: 8 }}
          >
            Enviar
          </Button>
        </div>
      </Space>
    </Drawer>
  );
}
