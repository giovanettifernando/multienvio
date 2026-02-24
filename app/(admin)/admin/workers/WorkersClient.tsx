'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Row, Col, Statistic, Tag, Space, Flex, Skeleton, Typography, Badge, Tabs, Table, Select, Popconfirm, App } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  DeleteOutlined,
  RedoOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { ELCard, ELButton } from '@/shared/ui';
import { PageShell } from '@/shared/ui/PageShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/utils/api-fetch';

// ============================================================================
// Types
// ============================================================================

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface WorkerStatus {
  process: {
    status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    pid: number | null;
    startedAt: string | null;
    uptimeSeconds: number | null;
    lastError: string | null;
  };
  queues: QueueStats[];
  logs: string[];
}

interface FailedJob {
  id: string;
  name: string;
  queue: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  maxAttempts: number;
  timestamp: number;
  finishedOn: number | null;
}

interface WebhookRecord {
  id: string;
  eventType: string | null;
  externalId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
}

// ============================================================================
// API
// ============================================================================

async function fetchWorkerStatus(): Promise<WorkerStatus> {
  return apiFetch<WorkerStatus>('/api/admin/workers');
}

async function workerAction(action: 'start' | 'stop' | 'restart') {
  return apiFetch<{ success: boolean; message: string }>('/api/admin/workers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

async function fetchFailedJobs(queue: string, page: number) {
  return apiFetch<{ jobs: FailedJob[]; total: number; queue: string }>(
    `/api/admin/workers/jobs?queue=${encodeURIComponent(queue)}&page=${page}&pageSize=20`
  );
}

async function jobAction(payload: { action: string; queue: string; jobIds?: string[] }) {
  return apiFetch<{ success: boolean; message: string; affected: number }>('/api/admin/workers/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function fetchFailedWebhooks(page: number) {
  return apiFetch<{ webhooks: WebhookRecord[]; total: number }>(
    `/api/admin/workers/webhooks?status=FAILED&page=${page}&pageSize=20`
  );
}

async function retryWebhooks(webhookIds: string[]) {
  return apiFetch<{ success: boolean; message: string; retriedCount: number }>('/api/admin/workers/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'retry', webhookIds }),
  });
}

// ============================================================================
// Helpers
// ============================================================================

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function statusColor(status: WorkerStatus['process']['status']): string {
  switch (status) {
    case 'running': return 'green';
    case 'stopped': return 'default';
    case 'starting': return 'blue';
    case 'stopping': return 'orange';
    case 'error': return 'red';
    default: return 'default';
  }
}

function statusLabel(status: WorkerStatus['process']['status']): string {
  switch (status) {
    case 'running': return 'Rodando';
    case 'stopped': return 'Parado';
    case 'starting': return 'Iniciando';
    case 'stopping': return 'Parando';
    case 'error': return 'Erro';
    default: return status;
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// ============================================================================
// Components
// ============================================================================

function ProcessCard({ process }: { process: WorkerStatus['process'] }) {
  return (
    <ELCard>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Status do Processo
          </Typography.Text>
          <Flex align="center" gap={8} style={{ marginTop: 4 }}>
            <Tag color={statusColor(process.status)} style={{ margin: 0, fontSize: 14, padding: '2px 12px' }}>
              {statusLabel(process.status)}
            </Tag>
            {process.pid && (
              <Typography.Text type="secondary">PID: {process.pid}</Typography.Text>
            )}
          </Flex>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Uptime
          </Typography.Text>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {formatUptime(process.uptimeSeconds)}
          </div>
        </div>
      </Flex>
      {process.lastError && (
        <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', borderRadius: 6, fontSize: 13 }}>
          <WarningOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />
          {process.lastError}
        </div>
      )}
    </ELCard>
  );
}

function QueueCard({ queue }: { queue: QueueStats }) {
  const total = queue.waiting + queue.active + queue.delayed;
  const hasIssues = queue.failed > 0;

  return (
    <ELCard>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Typography.Text strong style={{ fontSize: 14 }}>
          {queue.name}
        </Typography.Text>
        {hasIssues ? (
          <Badge count={queue.failed} size="small" />
        ) : total > 0 ? (
          <Badge status="processing" />
        ) : (
          <Badge status="default" />
        )}
      </Flex>
      <Row gutter={[8, 8]}>
        <Col span={8}>
          <Statistic
            title="Aguardando"
            value={queue.waiting}
            valueStyle={{ fontSize: 18, color: queue.waiting > 0 ? '#1677ff' : undefined }}
            prefix={<ClockCircleOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Ativos"
            value={queue.active}
            valueStyle={{ fontSize: 18, color: queue.active > 0 ? '#52c41a' : undefined }}
            prefix={<LoadingOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Falharam"
            value={queue.failed}
            valueStyle={{ fontSize: 18, color: queue.failed > 0 ? '#ff4d4f' : undefined }}
            prefix={<CloseCircleOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Concluidos"
            value={queue.completed}
            valueStyle={{ fontSize: 18 }}
            prefix={<CheckCircleOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Atrasados"
            value={queue.delayed}
            valueStyle={{ fontSize: 18, color: queue.delayed > 0 ? '#faad14' : undefined }}
            prefix={<WarningOutlined />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Pausados"
            value={queue.paused}
            valueStyle={{ fontSize: 18 }}
            prefix={<PauseCircleOutlined />}
          />
        </Col>
      </Row>
    </ELCard>
  );
}

function LogViewer({ logs }: { logs: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  return (
    <ELCard>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Typography.Text strong>Logs do Processo</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {logs.length} linhas {autoScroll ? '(auto-scroll)' : ''}
        </Typography.Text>
      </Flex>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          background: '#1a1a2e',
          color: '#e0e0e0',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          padding: 12,
          borderRadius: 8,
          maxHeight: 360,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: '#666' }}>Nenhum log disponivel. Inicie os workers.</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} style={{ color: line.includes('[ERR]') ? '#ff6b6b' : line.includes('completed') ? '#69db7c' : '#e0e0e0' }}>
              {line}
            </div>
          ))
        )}
      </div>
    </ELCard>
  );
}

// ============================================================================
// Failed Jobs (DLQ) Tab
// ============================================================================

function FailedJobsPanel({ queues }: { queues: QueueStats[] }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const queuesWithFailed = queues.filter((q) => q.failed > 0);
  const [selectedQueue, setSelectedQueue] = useState<string>(queuesWithFailed[0]?.name ?? queues[0]?.name ?? '');
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const { data: failedData, isLoading } = useQuery({
    queryKey: ['admin', 'workers', 'failed-jobs', selectedQueue, page],
    queryFn: () => fetchFailedJobs(selectedQueue, page),
    enabled: !!selectedQueue,
  });

  const actionMutation = useMutation({
    mutationFn: jobAction,
    onSuccess: (data) => {
      message.success(data.message);
      setSelectedJobIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
    },
    onError: () => {
      message.error('Falha ao executar ação');
    },
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 220,
      render: (id: string) => (
        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{id}</Typography.Text>
      ),
    },
    {
      title: 'Job',
      dataIndex: 'name',
      width: 100,
    },
    {
      title: 'Erro',
      dataIndex: 'failedReason',
      ellipsis: true,
      render: (reason: string) => (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>{reason}</Typography.Text>
      ),
    },
    {
      title: 'Tentativas',
      width: 100,
      render: (_: unknown, job: FailedJob) => (
        <Tag color={job.attemptsMade >= job.maxAttempts ? 'red' : 'orange'}>
          {job.attemptsMade}/{job.maxAttempts}
        </Tag>
      ),
    },
    {
      title: 'Data',
      dataIndex: 'timestamp',
      width: 160,
      render: (ts: number) => <span style={{ fontSize: 12 }}>{formatTimestamp(ts)}</span>,
    },
    {
      title: 'Ações',
      width: 100,
      render: (_: unknown, job: FailedJob) => (
        <Space size={4}>
          <ELButton
            size="small"
            icon={<RedoOutlined />}
            onClick={() => actionMutation.mutate({ action: 'retry', queue: selectedQueue, jobIds: [job.id] })}
            disabled={actionMutation.isPending}
          />
          <Popconfirm
            title="Remover este job?"
            onConfirm={() => actionMutation.mutate({ action: 'delete', queue: selectedQueue, jobIds: [job.id] })}
          >
            <ELButton size="small" variant="danger" icon={<DeleteOutlined />} disabled={actionMutation.isPending} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Flex align="center" gap={8}>
          <Typography.Text type="secondary">Fila:</Typography.Text>
          <Select
            value={selectedQueue}
            onChange={(v) => { setSelectedQueue(v); setPage(0); setSelectedJobIds([]); }}
            style={{ minWidth: 240 }}
            options={queues.map((q) => ({
              value: q.name,
              label: (
                <Flex justify="space-between" style={{ width: '100%' }}>
                  <span>{q.name}</span>
                  {q.failed > 0 && <Badge count={q.failed} size="small" />}
                </Flex>
              ),
            }))}
          />
        </Flex>
        <Space>
          {selectedJobIds.length > 0 && (
            <>
              <ELButton
                size="small"
                icon={<RedoOutlined />}
                onClick={() => actionMutation.mutate({ action: 'retry', queue: selectedQueue, jobIds: selectedJobIds })}
                disabled={actionMutation.isPending}
              >
                Retry ({selectedJobIds.length})
              </ELButton>
              <Popconfirm
                title={`Remover ${selectedJobIds.length} job(s)?`}
                onConfirm={() => actionMutation.mutate({ action: 'delete', queue: selectedQueue, jobIds: selectedJobIds })}
              >
                <ELButton size="small" variant="danger" icon={<DeleteOutlined />} disabled={actionMutation.isPending}>
                  Remover ({selectedJobIds.length})
                </ELButton>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="Retry todos os jobs falhados desta fila?"
            onConfirm={() => actionMutation.mutate({ action: 'retryAll', queue: selectedQueue })}
          >
            <ELButton size="small" icon={<RedoOutlined />} disabled={actionMutation.isPending || !failedData?.total}>
              Retry Todos
            </ELButton>
          </Popconfirm>
          <Popconfirm
            title="Remover todos os jobs falhados desta fila?"
            icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            onConfirm={() => actionMutation.mutate({ action: 'deleteAll', queue: selectedQueue })}
          >
            <ELButton size="small" variant="danger" icon={<DeleteOutlined />} disabled={actionMutation.isPending || !failedData?.total}>
              Limpar Todos
            </ELButton>
          </Popconfirm>
        </Space>
      </Flex>

      <Table
        rowKey="id"
        dataSource={failedData?.jobs ?? []}
        columns={columns}
        loading={isLoading}
        size="small"
        pagination={{
          current: page + 1,
          pageSize: 20,
          total: failedData?.total ?? 0,
          onChange: (p) => setPage(p - 1),
          showSizeChanger: false,
          showTotal: (total) => `${total} job(s) falhado(s)`,
        }}
        rowSelection={{
          selectedRowKeys: selectedJobIds,
          onChange: (keys) => setSelectedJobIds(keys as string[]),
        }}
        expandable={{
          expandedRowRender: (job) => (
            <div style={{ padding: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Payload:</Typography.Text>
              <pre style={{ fontSize: 11, background: '#f5f5f5', padding: 8, borderRadius: 4, maxHeight: 200, overflow: 'auto', margin: '4px 0 0' }}>
                {JSON.stringify(job.data, null, 2)}
              </pre>
            </div>
          ),
        }}
        locale={{ emptyText: 'Nenhum job falhado nesta fila' }}
      />
    </div>
  );
}

// ============================================================================
// Webhooks Tab
// ============================================================================

function WebhooksPanel() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const { data: webhookData, isLoading } = useQuery({
    queryKey: ['admin', 'workers', 'failed-webhooks', page],
    queryFn: () => fetchFailedWebhooks(page),
  });

  const retryMutation = useMutation({
    mutationFn: retryWebhooks,
    onSuccess: (data) => {
      message.success(data.message);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] });
    },
    onError: () => {
      message.error('Falha ao re-enfileirar webhooks');
    },
  });

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 200,
      render: (id: string) => (
        <Typography.Text copyable style={{ fontSize: 12, fontFamily: 'monospace' }}>{id}</Typography.Text>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'eventType',
      width: 120,
      render: (type: string | null) => type ?? '-',
    },
    {
      title: 'External ID',
      dataIndex: 'externalId',
      width: 140,
      render: (id: string | null) => id ? (
        <Typography.Text copyable style={{ fontSize: 12 }}>{id}</Typography.Text>
      ) : '-',
    },
    {
      title: 'Erro',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (msg: string | null) => msg ? (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>{msg}</Typography.Text>
      ) : '-',
    },
    {
      title: 'Data',
      dataIndex: 'createdAt',
      width: 160,
      render: (date: string) => (
        <span style={{ fontSize: 12 }}>
          {new Date(date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </span>
      ),
    },
    {
      title: 'Ações',
      width: 80,
      render: (_: unknown, record: WebhookRecord) => (
        <ELButton
          size="small"
          icon={<RedoOutlined />}
          onClick={() => retryMutation.mutate([record.id])}
          disabled={retryMutation.isPending}
        />
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Typography.Text type="secondary">
          Webhooks com status FAILED no banco de dados
        </Typography.Text>
        <Space>
          {selectedIds.length > 0 && (
            <ELButton
              size="small"
              icon={<RedoOutlined />}
              onClick={() => retryMutation.mutate(selectedIds)}
              disabled={retryMutation.isPending}
            >
              Retry ({selectedIds.length})
            </ELButton>
          )}
          {(webhookData?.total ?? 0) > 0 && (
            <ELButton
              size="small"
              icon={<RedoOutlined />}
              onClick={() => {
                const allIds = webhookData?.webhooks.map((w) => w.id) ?? [];
                if (allIds.length > 0) retryMutation.mutate(allIds);
              }}
              disabled={retryMutation.isPending}
            >
              Retry Todos da Pagina
            </ELButton>
          )}
        </Space>
      </Flex>

      <Table
        rowKey="id"
        dataSource={webhookData?.webhooks ?? []}
        columns={columns}
        loading={isLoading}
        size="small"
        pagination={{
          current: page + 1,
          pageSize: 20,
          total: webhookData?.total ?? 0,
          onChange: (p) => setPage(p - 1),
          showSizeChanger: false,
          showTotal: (total) => `${total} webhook(s) falhado(s)`,
        }}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as string[]),
        }}
        locale={{ emptyText: 'Nenhum webhook falhado' }}
      />
    </div>
  );
}

// ============================================================================
// Main
// ============================================================================

export default function WorkersClient() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['admin', 'workers', 'status'],
    queryFn: fetchWorkerStatus,
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: workerAction,
    onSuccess: () => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['admin', 'workers'] }), 1000);
    },
  });

  const isRunning = status?.process?.status === 'running';
  const isBusy = actionMutation.isPending ||
    status?.process?.status === 'starting' ||
    status?.process?.status === 'stopping';

  const totalWaiting = status?.queues?.reduce((sum, q) => sum + q.waiting, 0) ?? 0;
  const totalActive = status?.queues?.reduce((sum, q) => sum + q.active, 0) ?? 0;
  const totalFailed = status?.queues?.reduce((sum, q) => sum + q.failed, 0) ?? 0;
  const totalCompleted = status?.queues?.reduce((sum, q) => sum + q.completed, 0) ?? 0;

  return (
    <PageShell
      title="Workers BullMQ"
      gap="md"
      extra={
        <Space>
          {!isRunning ? (
            <ELButton
              variant="primary"
              onClick={() => actionMutation.mutate('start')}
              disabled={isBusy}
              icon={<PlayCircleOutlined />}
            >
              Iniciar
            </ELButton>
          ) : (
            <>
              <ELButton
                onClick={() => actionMutation.mutate('restart')}
                disabled={isBusy}
                icon={<ReloadOutlined />}
              >
                Reiniciar
              </ELButton>
              <ELButton
                variant="danger"
                onClick={() => actionMutation.mutate('stop')}
                disabled={isBusy}
                icon={<PauseCircleOutlined />}
              >
                Parar
              </ELButton>
            </>
          )}
        </Space>
      }
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {/* Status do processo */}
          {status && <ProcessCard process={status.process} />}

          {/* KPIs resumo */}
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={6}>
              <ELCard>
                <Statistic
                  title="Aguardando"
                  value={totalWaiting}
                  valueStyle={{ color: totalWaiting > 0 ? '#1677ff' : undefined }}
                  prefix={<ClockCircleOutlined />}
                />
              </ELCard>
            </Col>
            <Col xs={12} sm={6}>
              <ELCard>
                <Statistic
                  title="Processando"
                  value={totalActive}
                  valueStyle={{ color: totalActive > 0 ? '#52c41a' : undefined }}
                  prefix={<LoadingOutlined />}
                />
              </ELCard>
            </Col>
            <Col xs={12} sm={6}>
              <ELCard>
                <Statistic
                  title="Concluidos"
                  value={totalCompleted}
                  prefix={<CheckCircleOutlined />}
                />
              </ELCard>
            </Col>
            <Col xs={12} sm={6}>
              <ELCard>
                <Statistic
                  title="Falharam"
                  value={totalFailed}
                  valueStyle={{ color: totalFailed > 0 ? '#ff4d4f' : undefined }}
                  prefix={<CloseCircleOutlined />}
                />
              </ELCard>
            </Col>
          </Row>

          {/* Tabs: Filas / Jobs Falhados / Webhooks / Logs */}
          <Tabs
            defaultActiveKey="queues"
            items={[
              {
                key: 'queues',
                label: 'Filas',
                children: (
                  <Row gutter={[12, 12]}>
                    {status?.queues?.map((queue) => (
                      <Col xs={24} sm={12} lg={8} key={queue.name}>
                        <QueueCard queue={queue} />
                      </Col>
                    ))}
                  </Row>
                ),
              },
              {
                key: 'failed-jobs',
                label: (
                  <Flex align="center" gap={4}>
                    Jobs Falhados
                    {totalFailed > 0 && <Badge count={totalFailed} size="small" />}
                  </Flex>
                ),
                children: status?.queues ? (
                  <FailedJobsPanel queues={status.queues} />
                ) : null,
              },
              {
                key: 'webhooks',
                label: 'Webhooks',
                children: <WebhooksPanel />,
              },
              {
                key: 'logs',
                label: 'Logs',
                children: <LogViewer logs={status?.logs ?? []} />,
              },
            ]}
          />
        </>
      )}
    </PageShell>
  );
}
