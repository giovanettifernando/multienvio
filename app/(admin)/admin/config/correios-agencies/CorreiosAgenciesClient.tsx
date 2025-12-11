'use client';

import { useState } from 'react';
import {
  App,
  Button,
  Card,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { ELInput } from '@/components/ui/ELInput';

const { Title, Text } = Typography;

// UFs do Brasil
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface CorreiosAgency {
  id: string;
  nome: string;
  status: 'ATIVA' | 'INATIVA' | 'OUTRO';
  tipoUnidadeSigla: string;
  tipoUnidadeDescricao: string | null;
  cep: string;
  uf: string;
  municipio: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  horarioFuncionamento: string | null;
  iniExpediente: string | null;
  fimExpediente: string | null;
  syncedAt: string | null;
}

interface AgenciesResponse {
  items: CorreiosAgency[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    byStatus: Record<string, number>;
    lastSync: string | null;
  };
}

interface SyncResponse {
  success: boolean;
  message: string;
  stats: {
    ufsProcessadas: number;
    agenciasProcessadas: number;
    erros: number;
    duration: number;
  };
  errors?: Array<{ uf: string; error: string }>;
}

async function fetchAgencies(params: {
  page: number;
  pageSize: number;
  uf?: string;
  q?: string;
}): Promise<AgenciesResponse> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    pageSize: params.pageSize.toString(),
  });

  if (params.uf) {
    searchParams.append('uf', params.uf);
  }
  if (params.q) {
    searchParams.append('q', params.q);
  }

  const response = await fetch(`/api/admin/correios-agencies?${searchParams}`);
  if (!response.ok) {
    throw new Error('Erro ao buscar agências');
  }
  const json = await response.json();
  return json.data ?? json;
}

async function syncAgencies(ufs?: string[]): Promise<SyncResponse> {
  const response = await fetch('/api/admin/correios-agencies/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ufs }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao sincronizar');
  }
  const json = await response.json();
  return json.data ?? json;
}

export default function CorreiosAgenciesClient() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [uf, setUf] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [syncUfs, setSyncUfs] = useState<string[]>([]);

  // Query para buscar agências
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['correios-agencies', page, pageSize, uf, search],
    queryFn: () => fetchAgencies({ page, pageSize, uf, q: search || undefined }),
  });

  // Mutation para sincronizar
  const syncMutation = useMutation({
    mutationFn: syncAgencies,
    onSuccess: (result) => {
      message.success(result.message);
      queryClient.invalidateQueries({ queryKey: ['correios-agencies'] });
      if (result.errors && result.errors.length > 0) {
        message.warning(`${result.errors.length} UF(s) com erro durante sincronização`);
      }
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : 'Erro ao sincronizar');
    },
  });

  const handleSync = () => {
    syncMutation.mutate(syncUfs.length > 0 ? syncUfs : undefined);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const columns: ColumnsType<CorreiosAgency> = [
    {
      title: 'Agência',
      key: 'nome',
      width: 250,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.nome}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.tipoUnidadeDescricao || record.tipoUnidadeSigla}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Localização',
      key: 'localizacao',
      width: 250,
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text>{record.municipio}/{record.uf}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.bairro || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Endereço',
      key: 'endereco',
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.logradouro ? `${record.logradouro}${record.numero ? `, ${record.numero}` : ''}` : '-'}
          <br />
          CEP: {record.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
        </Text>
      ),
    },
    {
      title: 'Horário',
      key: 'horario',
      width: 120,
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.iniExpediente && record.fimExpediente
            ? `${record.iniExpediente} - ${record.fimExpediente}`
            : record.horarioFuncionamento || '-'}
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Tag color={record.status === 'ATIVA' ? 'green' : 'red'}>
          {record.status}
        </Tag>
      ),
    },
  ];

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  };

  return (
    <div style={{ padding: 24 }}>
      <Space orientation="vertical" size={24} style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <EnvironmentOutlined /> Agências dos Correios
          </Title>
          <Space wrap>
            <Select
              mode="multiple"
              placeholder="UFs para sincronizar (todas)"
              style={{ minWidth: 200 }}
              options={UFS.map((u) => ({ label: u, value: u }))}
              value={syncUfs}
              onChange={setSyncUfs}
              maxTagCount={3}
              allowClear
            />
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              onClick={handleSync}
              loading={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Agências'}
            </Button>
          </Space>
        </div>

        {/* Estatísticas */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Card size="small" style={{ minWidth: 150 }}>
            <Statistic
              title="Total"
              value={data?.total || 0}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
          <Card size="small" style={{ minWidth: 150 }}>
            <Statistic
              title="Ativas"
              value={data?.stats?.byStatus?.ATIVA || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
          <Card size="small" style={{ minWidth: 150 }}>
            <Statistic
              title="Inativas"
              value={data?.stats?.byStatus?.INATIVA || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
          <Card size="small" style={{ minWidth: 200 }}>
            <Statistic
              title="Última Sincronização"
              value={formatLastSync(data?.stats?.lastSync || null)}
              valueStyle={{ fontSize: 14 }}
            />
          </Card>
        </div>

        {/* Filtros */}
        <Card size="small">
          <Space wrap>
            <Select
              placeholder="Filtrar por UF"
              style={{ width: 120 }}
              options={[
                { label: 'Todas UFs', value: '' },
                ...UFS.map((u) => ({ label: u, value: u })),
              ]}
              value={uf || ''}
              onChange={(v) => {
                setUf(v || undefined);
                setPage(1);
              }}
              allowClear
            />
            <ELInput.Search
              placeholder="Buscar por nome, município..."
              onSearch={handleSearch}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Atualizar
            </Button>
          </Space>
        </Card>

        {/* Tabela */}
        <Table
          columns={columns}
          dataSource={data?.items || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            showTotal: (total) => `${total} agências`,
          }}
          scroll={{ x: 900 }}
          size="small"
        />
      </Space>
    </div>
  );
}
