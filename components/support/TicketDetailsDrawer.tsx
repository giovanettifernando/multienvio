'use client';

import {
  Drawer,
  Descriptions,
  Tag,
  Timeline,
  Input,
  Button,
  Space,
  Typography,
  Select,
  App,
  Divider,
  Empty,
  Skeleton,
  Result,
  Upload,
} from 'antd';
import { PaperClipOutlined, ReloadOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import {
  useAssignTicket,
  usePostTicketMessage,
  useTicket,
  useUpdateTicketStatus,
} from '@/hooks/useSupport';
import type { Status, Priority, AuthorRole } from '@/lib/validation/support';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

const { TextArea } = Input;
const { Text, Title } = Typography;

type Audience = 'user' | 'admin' | 'collector';

interface TicketDetailsBaseProps {
  ticketId: string | null;
  userRole?: AuthorRole;
  audience?: Audience;
  enableQuery?: boolean;
  onComposingChange?: (value: boolean) => void;
}

interface TicketDetailsDrawerProps extends TicketDetailsBaseProps {
  open: boolean;
  onClose: () => void;
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

function formatFileSize(size?: number | null): string | null {
  if (size === undefined || size === null) return null;
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

export function TicketDetailsContent({
  ticketId,
  userRole = 'cliente',
  audience: audienceProp,
  enableQuery = true,
  onComposingChange,
}: TicketDetailsBaseProps) {
  // Use explicit audience prop if provided, otherwise derive from userRole
  const audience = audienceProp ?? (userRole === 'admin' ? 'admin' : 'user');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  // Stabilize callback with useRef to avoid re-renders
  const onComposingChangeRef = useRef(onComposingChange);
  useEffect(() => {
    onComposingChangeRef.current = onComposingChange;
  });

  const ticketQuery = useTicket(ticketId, audience, {
    enabled: enableQuery && !isComposing,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  const postMessage = usePostTicketMessage(audience);
  const updateStatus = useUpdateTicketStatus();
  const assignTicket = useAssignTicket();
  const { message } = App.useApp();
  const [sending, setSending] = useState(false);
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const staffUsersQuery = useQuery({
    queryKey: ['adminStaffUsers'],
    queryFn: async (): Promise<Array<{ id: string; name: string; email: string }>> => {
      const response = await fetch('/api/admin/staff/users?status=active', {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json().catch(() => undefined);
      if (!response.ok) {
        const errorMessage =
          (data as Record<string, unknown> | undefined)?.message ??
          'Não foi possível carregar a equipe de suporte.';
        throw new Error(String(errorMessage));
      }
      const users = (data as { users?: Array<{ id: string; name: string; email: string }> } | undefined)
        ?.users;
      return users ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: userRole === 'admin',
  });

  useEffect(() => {
    setMessageText('');
    setFileList([]);
    setIsTextareaFocused(false);
    setIsComposing(false);
  }, [ticketId]);

  useEffect(() => {
    if (!enableQuery) {
      setMessageText('');
      setFileList([]);
      setIsTextareaFocused(false);
      setIsComposing(false);
      postMessage.reset();
      updateStatus.reset();
      assignTicket.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableQuery]);

  useEffect(() => {
    if (userRole === 'admin' && staffUsersQuery.isError) {
      const err = staffUsersQuery.error;
      const text =
        err instanceof Error ? err.message : 'Não foi possível carregar a equipe de suporte.';
      message.error(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUsersQuery.isError, staffUsersQuery.error, userRole]);

  useEffect(() => {
    const next =
      isTextareaFocused || messageText.trim().length > 0 || fileList.length > 0;
    setIsComposing((prev) => (prev === next ? prev : next));
  }, [isTextareaFocused, messageText, fileList]);

  useEffect(() => {
    onComposingChangeRef.current?.(isComposing);
  }, [isComposing]);

  useEffect(() => {
    return () => {
      onComposingChangeRef.current?.(false);
    };
  }, []);

  const ticket = ticketQuery.data;
  const isLoading = ticketQuery.isLoading || ticketQuery.isFetching;
  const error = ticketQuery.isError ? ticketQuery.error : null;

  const staffUsers = useMemo(
    () => staffUsersQuery.data ?? [],
    [staffUsersQuery.data],
  );
  const staffOptions = useMemo(
    () =>
      staffUsers.map((user) => ({
        value: user.id,
        label: `${user.name} (${user.email})`,
      })),
    [staffUsers],
  );
  const currentAssigneeId = useMemo(() => {
    if (!ticket) return undefined;
    const byId = staffUsers.find((user) => user.id === ticket.assignedTo);
    if (byId) return byId.id;
    const byName = staffUsers.find((user) => user.name === ticket.assignedTo);
    return byName?.id;
  }, [staffUsers, ticket]);

  const handleBeforeUpload = (file: RcFile) => {
    if (file.size > MAX_FILE_SIZE) {
      message.error('Cada arquivo deve ter no máximo 10 MB.');
      return Upload.LIST_IGNORE;
    }
    if (fileList.length >= MAX_FILES) {
      message.warning(`É permitido enviar até ${MAX_FILES} arquivos por mensagem.`);
      return Upload.LIST_IGNORE;
    }
    return false;
  };

const handleSendMessage = async () => {
    if (!messageText.trim() || !ticketId) return;

    setSending(true);
    try {
      const attachments = fileList
        .map((upload) => upload.originFileObj)
        .filter((file): file is RcFile => !!file)
        .map((file) => file as File);
      await postMessage.mutateAsync({
        ticketId,
        text: messageText.trim(),
        attachments: attachments.length ? attachments : undefined,
        internal: userRole === 'admin' ? false : undefined,
      });
      setMessageText('');
      setFileList([]);
      setIsTextareaFocused(false);
      message.success('Mensagem enviada');
      await ticketQuery.refetch();
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
      message.error(text);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: Status) => {
    if (!ticketId) return;
    try {
      await updateStatus.mutateAsync({ ticketId, status: newStatus });
      message.success('Status atualizado');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Erro ao atualizar status';
      message.error(text);
    }
  };

  const handleAssign = async (assignedTo: string | null) => {
    if (!ticketId) return;
    const normalized = assignedTo ?? null;
    const current = currentAssigneeId ?? null;
    if (normalized === current) {
      return;
    }
    try {
      await assignTicket.mutateAsync({ ticketId, assignedTo: normalized });
      message.success(normalized ? 'Chamado atribuído' : 'Atribuição removida');
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Erro ao atualizar atribuição';
      message.error(text);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Space orientation="vertical" style={{ width: '100%' }} size="large">
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </Space>
      );
    }

    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar chamado';
      return (
        <Result
          status="error"
          title="Não foi possível carregar o chamado"
          subTitle={errorMessage}
          extra={
            <Button type="primary" onClick={() => ticketQuery.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      );
    }

    if (!ticket) {
      return <Empty description="Chamado não encontrado" />;
    }

    return (
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Space
          style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}
          align="start"
          wrap
        >
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>{ticket.subject}</Title>
            <Space wrap>
              <Tag color={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Tag>
              <Tag color={priorityColors[ticket.priority]}>{priorityLabels[ticket.priority]}</Tag>
              {(ticket.tags ?? []).map(tag => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              void ticketQuery.refetch();
            }}
            loading={ticketQuery.isFetching}
            variant="outlined"
          >
            Atualizar
          </Button>
        </Space>

        {userRole === 'admin' && (
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Select
                value={ticket.status}
                onChange={handleStatusChange}
                style={{ width: 200 }}
                options={[
                  { value: 'aberto', label: 'Aberto' },
                  { value: 'em_atendimento', label: 'Em Atendimento' },
                  { value: 'resolvido', label: 'Resolvido' },
                  { value: 'fechado', label: 'Fechado' },
                ]}
                loading={updateStatus.isPending}
              />
              <Select
                value={currentAssigneeId ?? undefined}
                placeholder="Atribuir a..."
                onChange={(value) => {
                  void handleAssign((value as string | undefined) ?? null);
                }}
                allowClear
                style={{ width: 220 }}
                options={staffOptions}
                loading={staffUsersQuery.isLoading || staffUsersQuery.isFetching || assignTicket.isPending}
                disabled={staffUsersQuery.isLoading || assignTicket.isPending}
              />
            </Space>
          </Space>
        )}

        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Solicitante">
            <Space orientation="vertical" size={0}>
              <Text strong>{ticket.requester?.name || 'N/A'}</Text>
              <Text type="secondary">{ticket.requester?.email || 'N/A'}</Text>
              {ticket.requester?.phone && (
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

        <div>
          <Title level={5}>Histórico de Mensagens</Title>
          {ticket.messages.length === 0 ? (
            <Empty description="Nenhuma mensagem ainda" />
          ) : (
            <Timeline
              items={ticket.messages.map((msg) => ({
                key: msg.id,
                color: msg.authorRole === 'admin' ? 'blue' : 'green',
                content: (
                  <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <Text strong>
                        {msg.authorRole === 'admin' ? '🔧' : '👤'} {msg.authorName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(msg.at).format('DD/MM HH:mm')}
                      </Text>
                    </Space>
                    <Text>{msg.text}</Text>
                    {msg.attachments && msg.attachments.length > 0 ? (
                      <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                        {msg.attachments.map((attachment) => {
                          if (!attachment.url) {
                            return null;
                          }
                          const sizeLabel = formatFileSize(attachment.size ?? null);
                          return (
                            <Space key={attachment.id} size={6} align="center">
                              <PaperClipOutlined />
                              <Typography.Link
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {attachment.name}
                              </Typography.Link>
                              {sizeLabel ? (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {sizeLabel}
                                </Text>
                              ) : null}
                            </Space>
                          );
                        })}
                      </Space>
                    ) : null}
                  </Space>
                ),
              }))}
            />
          )}
        </div>

        <div>
          <Title level={5}>Responder</Title>
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onFocus={() => setIsTextareaFocused(true)}
              onBlur={() => setIsTextareaFocused(false)}
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
          <Upload
            multiple
            fileList={fileList}
            beforeUpload={handleBeforeUpload}
            maxCount={MAX_FILES}
            onRemove={(file) => {
              setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
            }}
            onChange={({ fileList: newList }) => {
              setFileList(newList.slice(0, MAX_FILES));
            }}
            aria-label="Anexar arquivos à resposta"
            style={{ marginTop: 8 }}
          >
            <Button variant="outlined">Anexar arquivo</Button>
          </Upload>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSendMessage}
            loading={sending || postMessage.isPending}
            disabled={!messageText.trim()}
            style={{ marginTop: 8 }}
          >
            Enviar
          </Button>
        </div>
      </Space>
    );
  };

  return (
      <>
        {renderContent()}
      </>
  );
}

export function TicketDetailsDrawer({
  ticketId,
  open,
  onClose,
  userRole = 'cliente',
  audience,
  onComposingChange,
}: TicketDetailsDrawerProps) {
  const title = ticketId ? `Chamado #${ticketId.slice(0, 8)}` : 'Detalhes do Chamado';

  // Stabilize callback
  const onComposingChangeRef = useRef(onComposingChange);
  useEffect(() => {
    onComposingChangeRef.current = onComposingChange;
  });

  useEffect(() => {
    if (!open) {
      onComposingChangeRef.current?.(false);
    }
  }, [open]);

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      size="large"
    >
      <TicketDetailsContent
        ticketId={ticketId}
        userRole={userRole}
        audience={audience}
        enableQuery={Boolean(open && ticketId)}
        onComposingChange={onComposingChange}
      />
    </Drawer>
  );
}
