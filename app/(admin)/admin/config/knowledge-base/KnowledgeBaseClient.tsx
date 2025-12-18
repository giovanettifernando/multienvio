'use client';

import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  Switch,
  message,
  Popconfirm,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TableProps } from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Types
// ============================================================================

interface Article {
  id: string;
  slug: string;
  title: string;
  contentMarkdown: string;
  category: string | null;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ArticleListResponse {
  articles: Article[];
  total: number;
}

interface ArticleFormData {
  slug: string;
  title: string;
  contentMarkdown: string;
  category?: string;
  tags?: string[];
  isPublished: boolean;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchArticles(params: { category?: string; published?: string; q?: string }): Promise<ArticleListResponse> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.published) searchParams.set('published', params.published);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/admin/knowledge-base?${searchParams}`);
  if (!res.ok) throw new Error('Erro ao carregar artigos');
  const json = await res.json();
  return json.data ?? json;
}

async function fetchArticle(id: string): Promise<Article> {
  const res = await fetch(`/api/admin/knowledge-base/${id}`);
  if (!res.ok) throw new Error('Erro ao carregar artigo');
  const json = await res.json();
  return json.data ?? json;
}

async function createArticle(data: ArticleFormData): Promise<Article> {
  const res = await fetch('/api/admin/knowledge-base', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Erro ao criar artigo');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function updateArticle(id: string, data: Partial<ArticleFormData>): Promise<Article> {
  const res = await fetch(`/api/admin/knowledge-base/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Erro ao atualizar artigo');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function deleteArticle(id: string): Promise<void> {
  const res = await fetch(`/api/admin/knowledge-base/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Erro ao excluir artigo');
  }
}

// ============================================================================
// Categories
// ============================================================================

const CATEGORIES = [
  { value: 'envios', label: 'Envios' },
  { value: 'pagamentos', label: 'Pagamentos' },
  { value: 'conta', label: 'Conta' },
  { value: 'suporte', label: 'Suporte' },
  { value: 'politicas', label: 'Políticas' },
  { value: 'geral', label: 'Geral' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function KnowledgeBaseClient() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    published: '',
    q: '',
  });

  // Query articles
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'knowledge-base', 'articles', filters],
    queryFn: () => fetchArticles(filters),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createArticle,
    onSuccess: () => {
      message.success('Artigo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
      closeModal();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArticleFormData> }) => updateArticle(id, data),
    onSuccess: () => {
      message.success('Artigo atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
      closeModal();
    },
    onError: (err: Error) => message.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => {
      message.success('Artigo excluído com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'knowledge-base'] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    form.resetFields();
  };

  const openNewArticle = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ isPublished: false, tags: [] });
    setModalOpen(true);
  };

  const openEditArticle = async (id: string) => {
    try {
      const article = await fetchArticle(id);
      setEditingId(id);
      form.setFieldsValue({
        slug: article.slug,
        title: article.title,
        contentMarkdown: article.contentMarkdown,
        category: article.category,
        tags: article.tags,
        isPublished: article.isPublished,
      });
      setModalOpen(true);
    } catch {
      message.error('Erro ao carregar artigo');
    }
  };

  const handleSubmit = (values: ArticleFormData) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  // Gerar slug a partir do título
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const columns: TableProps<Article>['columns'] = [
    {
      title: 'Título',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => (
        <div>
          <Text strong>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.slug}</Text>
        </div>
      ),
    },
    {
      title: 'Categoria',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string | null) => cat ? (
        <Tag>{CATEGORIES.find(c => c.value === cat)?.label || cat}</Tag>
      ) : '-',
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags.slice(0, 3).map(tag => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
          {tags.length > 3 && <Tag>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (published: boolean) => published ? (
        <Tag color="green">Publicado</Tag>
      ) : (
        <Tag color="orange">Rascunho</Tag>
      ),
    },
    {
      title: 'Atualizado',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => new Date(date).toLocaleDateString('pt-BR'),
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditArticle(record.id)}
          />
          <Popconfirm
            title="Excluir artigo?"
            description="Esta ação não pode ser desfeita"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Sim"
            cancelText="Não"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <BookOutlined style={{ marginRight: 8, color: '#722ed1' }} />
              Base de Conhecimento
            </Title>
            <Text type="secondary">
              Gerencie artigos que o assistente IA usa para responder perguntas
            </Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewArticle}>
            Novo Artigo
          </Button>
        </div>

        {/* Filters */}
        <Card size="small">
          <Space wrap>
            <Input
              placeholder="Buscar..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              value={filters.q}
              onChange={(e) => setFilters(f => ({ ...f, q: e.target.value }))}
              onPressEnter={() => refetch()}
            />
            <Select
              placeholder="Categoria"
              style={{ width: 150 }}
              allowClear
              value={filters.category || undefined}
              onChange={(value) => setFilters(f => ({ ...f, category: value || '' }))}
              options={CATEGORIES}
            />
            <Select
              placeholder="Status"
              style={{ width: 150 }}
              allowClear
              value={filters.published || undefined}
              onChange={(value) => setFilters(f => ({ ...f, published: value || '' }))}
              options={[
                { value: 'true', label: 'Publicados' },
                { value: 'false', label: 'Rascunhos' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Atualizar
            </Button>
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={data?.articles}
            rowKey="id"
            loading={isLoading}
            pagination={{
              total: data?.total,
              showTotal: (total) => `${total} artigos`,
              pageSize: 20,
            }}
            locale={{
              emptyText: (
                <Empty
                  description="Nenhum artigo encontrado"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={openNewArticle}>
                    Criar primeiro artigo
                  </Button>
                </Empty>
              ),
            }}
          />
        </Card>
      </Space>

      {/* Modal de Criação/Edição */}
      <Modal
        title={editingId ? 'Editar Artigo' : 'Novo Artigo'}
        open={modalOpen}
        onCancel={closeModal}
        width={800}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ isPublished: false, tags: [] }}
        >
          <Form.Item
            name="title"
            label="Título"
            rules={[{ required: true, message: 'Título é obrigatório' }]}
          >
            <Input
              placeholder="Como rastrear meu envio?"
              onChange={(e) => {
                if (!editingId) {
                  form.setFieldValue('slug', generateSlug(e.target.value));
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug (URL)"
            rules={[
              { required: true, message: 'Slug é obrigatório' },
              { pattern: /^[a-z0-9-]+$/, message: 'Apenas letras minúsculas, números e hífens' },
            ]}
            extra="Identificador único usado internamente"
          >
            <Input placeholder="como-rastrear-meu-envio" />
          </Form.Item>

          <Form.Item
            name="contentMarkdown"
            label="Conteúdo (Markdown)"
            rules={[{ required: true, message: 'Conteúdo é obrigatório' }]}
          >
            <TextArea
              rows={10}
              placeholder="# Como rastrear seu envio&#10;&#10;Para rastrear seu envio, siga os passos:&#10;&#10;1. Acesse 'Meus Envios'&#10;2. Clique no envio desejado&#10;3. Veja o histórico de rastreamento"
            />
          </Form.Item>

          <Space style={{ width: '100%' }}>
            <Form.Item name="category" label="Categoria" style={{ flex: 1 }}>
              <Select placeholder="Selecione..." options={CATEGORIES} allowClear />
            </Form.Item>

            <Form.Item name="tags" label="Tags" style={{ flex: 2 }}>
              <Select
                mode="tags"
                placeholder="Digite tags e pressione Enter"
                tokenSeparators={[',']}
              />
            </Form.Item>
          </Space>

          <Form.Item
            name="isPublished"
            label="Status"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Publicado"
              unCheckedChildren="Rascunho"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={closeModal}>Cancelar</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Salvar' : 'Criar'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
