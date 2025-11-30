'use client';

import { Form, Input, Select, Button, Space, Flex } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export interface BaseFilters {
  q?: string;
  status: string;
  uf?: string;
  cidade?: string;
  page: number;
}

interface StatusOption {
  label: string;
  value: string;
}

interface EntitySearchFiltersProps<T extends BaseFilters> {
  onChange: (filters: T) => void;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  defaultStatus?: string;
}

const defaultStatusOptions: StatusOption[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Ativo', value: 'ACTIVE' },
  { label: 'Bloqueado', value: 'BLOCKED' },
];

export default function EntitySearchFilters<T extends BaseFilters>({
  onChange,
  searchPlaceholder = 'Nome/CNPJ...',
  statusOptions = defaultStatusOptions,
  defaultStatus = 'all',
}: EntitySearchFiltersProps<T>) {
  const [form] = Form.useForm();

  const handleFilter = () => {
    const values = form.getFieldsValue();
    const nextFilters = {
      q: values.q || undefined,
      status: values.status || defaultStatus,
      uf: values.uf || undefined,
      cidade: values.cidade || undefined,
      page: 1,
    } as T;
    onChange(nextFilters);
  };

  const handleClear = () => {
    form.resetFields();
    onChange({ status: defaultStatus, page: 1 } as T);
  };

  return (
    <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
      <Flex gap={8} wrap="wrap" style={{ width: '100%' }}>
        <Form.Item name="q" style={{ marginBottom: 0, flexGrow: 1, minWidth: 200 }}>
          <Input
            placeholder={searchPlaceholder}
            prefix={<SearchOutlined />}
            allowClear
            onPressEnter={handleFilter}
          />
        </Form.Item>

        <Form.Item name="status" initialValue={defaultStatus} style={{ marginBottom: 0 }}>
          <Select
            placeholder="Status"
            style={{ width: 140 }}
            options={statusOptions}
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
