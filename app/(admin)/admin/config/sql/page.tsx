'use client';

import { useState, useCallback } from 'react';
import { App, Input, Table, Typography, Space, Alert, Spin } from 'antd';
import { PlayCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { PageShell } from '@/components/shared/PageShell';
import { ELButton } from '@/components/ui/ELButton';
import { ELCard } from '@/components/ui/ELCard';

const { TextArea } = Input;
const { Text } = Typography;

interface SqlResult {
  success: boolean;
  data?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  executionTimeMs?: number;
}

async function executeQuery(query: string): Promise<SqlResult> {
  const response = await fetch('/api/admin/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query }),
  });

  const json = await response.json();
  return json.data ?? json;
}

export default function AdminSqlPage() {
  const { message } = App.useApp();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SqlResult | null>(null);

  const executeMutation = useMutation({
    mutationFn: executeQuery,
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        message.success(`Query executada em ${data.executionTimeMs}ms - ${data.rowCount} linha(s)`);
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : 'Erro ao executar query';
      message.error(msg);
    },
  });

  const handleExecute = useCallback(() => {
    if (!query.trim()) {
      message.warning('Digite uma query para executar');
      return;
    }
    executeMutation.mutate(query);
  }, [query, executeMutation, message]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl+Enter ou Cmd+Enter para executar
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute]
  );

  // Gerar colunas dinamicamente a partir dos dados
  const columns = result?.data && result.data.length > 0
    ? Object.keys(result.data[0]).map((key) => ({
        title: key,
        dataIndex: key,
        key,
        ellipsis: true,
        render: (value: unknown) => {
          if (value === null) return <Text type="secondary">NULL</Text>;
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        },
      }))
    : [];

  return (
    <App>
      <PageShell title="SQL" gap="md">
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          message="Atenção"
          description="Esta ferramenta executa comandos SQL diretamente no banco de dados. Use com cuidado. Todas as execuções são registradas para auditoria."
          showIcon
          style={{ marginBottom: 16 }}
        />

        <ELCard
          header={{ title: 'Query SQL' }}
          padding="md"
        >
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <TextArea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua query SQL aqui... (Ctrl+Enter para executar)"
              autoSize={{ minRows: 6, maxRows: 20 }}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />

            <Space>
              <ELButton
                variant="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleExecute}
                loading={executeMutation.isPending}
              >
                Executar
              </ELButton>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ctrl+Enter para executar
              </Text>
            </Space>
          </Space>
        </ELCard>

        {executeMutation.isPending && (
          <ELCard padding="md">
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Executando query...</Text>
              </div>
            </div>
          </ELCard>
        )}

        {result && !executeMutation.isPending && (
          <ELCard
            header={{
              title: 'Resultado',
              extra: result.success ? (
                <Text type="secondary">
                  {result.rowCount} linha(s) em {result.executionTimeMs}ms
                </Text>
              ) : null,
            }}
            padding="md"
          >
            {result.success ? (
              result.data && result.data.length > 0 ? (
                <Table
                  dataSource={result.data.map((row, index) => ({ ...row, _key: index }))}
                  columns={columns}
                  rowKey="_key"
                  scroll={{ x: 'max-content' }}
                  pagination={{
                    pageSize: 50,
                    showSizeChanger: true,
                    showTotal: (total) => `Total: ${total} linhas`,
                  }}
                  size="small"
                />
              ) : (
                <Text type="secondary">Query executada com sucesso. Nenhum resultado retornado.</Text>
              )
            ) : (
              <Alert
                type="error"
                message="Erro na execução"
                description={
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {result.error}
                  </pre>
                }
              />
            )}
          </ELCard>
        )}
      </PageShell>
    </App>
  );
}
