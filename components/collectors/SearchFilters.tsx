'use client';

import { Form, Input, Select, Button, Space, Flex } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import type { CollectorFilters } from '@/lib/collectors/types';

interface SearchFiltersProps {
  onChange: (filters: CollectorFilters) => void;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function SearchFilters({ onChange }: SearchFiltersProps) {
  const [form] = Form.useForm();

  const handleFilter = () => {
    const values = form.getFieldsValue();
    const nextFilters: CollectorFilters = {
      q: values.q || undefined,
      status: values.status || 'all',
      uf: values.uf || undefined,
      cidade: values.cidade || undefined,
      page: 1,
    };
    onChange(nextFilters);
  };

  const handleClear = () => {
    form.resetFields();
    onChange({ status: 'all', page: 1 });
  };

  return (
    <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
      <Flex gap={8} wrap="wrap" style={{ width: '100%' }}>
        <Form.Item name="q" style={{ marginBottom: 0, flexGrow: 1, minWidth: 200 }}>
          <Input
            placeholder="Nome, CNPJ ou placa"
            prefix={<SearchOutlined />}
            allowClear
            onPressEnter={handleFilter}
          />
        </Form.Item>

        <Form.Item name="status" initialValue="all" style={{ marginBottom: 0 }}>
          <Select
            placeholder="Status"
            style={{ width: 140 }}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'Ativo', value: 'active' },
              { label: 'Bloqueado', value: 'blocked' },
            ]}
          />
        </Form.Item>

        <Form.Item name="uf" style={{ marginBottom: 0 }}>
          <Select
            placeholder="UF"
            style={{ width: 80 }}
            allowClear
            showSearch
            options={UFS.map((uf) => ({ label: uf, value: uf }))}
          />
        </Form.Item>

        <Form.Item name="cidade" style={{ marginBottom: 0 }}>
          <Input placeholder="Cidade" style={{ width: 160 }} allowClear />
        </Form.Item>

        <Space>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter}>
            Filtrar
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            Limpar
          </Button>
        </Space>
      </Flex>
    </Form>
  );
}
