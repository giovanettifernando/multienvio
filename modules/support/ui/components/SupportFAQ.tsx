'use client';

import { useState, useCallback } from 'react';
import { Collapse, Space, Typography, Skeleton, Divider, App } from 'antd';
import {
  SearchOutlined,
  QuestionCircleOutlined,
  LikeOutlined,
  DislikeOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { ELButton, ELEmpty, ELInput, ELSegmented, ELSkeleton } from '@/shared/ui';
import { useFAQ, useFAQFeedback, useFAQView, type FAQItem } from '@/modules/support/ui/hooks';

const { Text, Title } = Typography;

interface SupportFAQProps {
  audience?: 'USER' | 'COLLECTOR';
  showTitle?: boolean;
  maxItems?: number;
}

export function SupportFAQ({
  audience = 'USER',
  showTitle = true,
  maxItems,
}: SupportFAQProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'yes' | 'no'>>({});
  const { message } = App.useApp();

  const { data, isLoading, isError } = useFAQ({
    audience,
    search: search.length >= 2 ? search : undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
  });

  const feedbackMutation = useFAQFeedback();
  const viewMutation = useFAQView();

  const handleExpand = useCallback((keys: string | string[]) => {
    // Registrar visualização quando expande um item
    const expandedKeys = Array.isArray(keys) ? keys : [keys];
    expandedKeys.forEach((key) => {
      viewMutation.mutate(key);
    });
  }, [viewMutation]);

  const handleFeedback = useCallback(async (id: string, helpful: boolean) => {
    if (feedbackGiven[id]) return; // Já deu feedback

    try {
      await feedbackMutation.mutateAsync({ id, helpful });
      setFeedbackGiven((prev) => ({ ...prev, [id]: helpful ? 'yes' : 'no' }));
      message.success('Obrigado pelo feedback!');
    } catch {
      message.error('Erro ao enviar feedback');
    }
  }, [feedbackGiven, feedbackMutation, message]);

  const items = data?.items ?? [];
  const categories = data?.categories ?? [];
  const displayItems = maxItems ? items.slice(0, maxItems) : items;

  // Agrupar itens por categoria se houver
  const groupedItems = displayItems.reduce((acc, item) => {
    const cat = item.category || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  const renderFeedbackButtons = (item: FAQItem) => {
    const given = feedbackGiven[item.id];

    if (given) {
      return (
        <Space>
          <CheckOutlined style={{ color: '#52c41a' }} />
          <Text type="secondary">Obrigado pelo feedback!</Text>
        </Space>
      );
    }

    return (
      <Space>
        <Text type="secondary">Isso foi útil?</Text>
        <ELButton
          variant="text"
          size="small"
          icon={<LikeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleFeedback(item.id, true);
          }}
          loading={feedbackMutation.isPending}
        >
          Sim
        </ELButton>
        <ELButton
          variant="text"
          size="small"
          icon={<DislikeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleFeedback(item.id, false);
          }}
          loading={feedbackMutation.isPending}
        >
          Não
        </ELButton>
      </Space>
    );
  };

  const collapseItems = Object.entries(groupedItems).flatMap(([category, categoryItems]) => {
    // Se só tiver uma categoria, não mostrar header de categoria
    const showCategoryHeader = Object.keys(groupedItems).length > 1;

    const faqItems = categoryItems.map((item) => ({
      key: item.id,
      label: (
        <Space>
          <QuestionCircleOutlined style={{ color: '#1890ff' }} />
          <Text strong>{item.question}</Text>
        </Space>
      ),
      children: (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div
            style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: item.answer.replace(/\n/g, '<br/>') }}
          />
          <Divider style={{ margin: '12px 0' }} />
          {renderFeedbackButtons(item)}
        </Space>
      ),
    }));

    if (showCategoryHeader) {
      return [
        {
          key: `category-${category}`,
          label: <Text type="secondary" strong>{category}</Text>,
          children: (
            <Collapse
              items={faqItems}
              onChange={handleExpand}
              bordered={false}
              expandIconPlacement="end"
            />
          ),
          showArrow: false,
          collapsible: 'header' as const,
        },
      ];
    }

    return faqItems;
  });

  if (isError) {
    return (
      <ELEmpty
        message="Erro ao carregar perguntas frequentes"
      />
    );
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {showTitle && (
        <Title level={5} style={{ margin: 0 }}>
          <QuestionCircleOutlined style={{ marginRight: 8 }} />
          Perguntas Frequentes
        </Title>
      )}

      <Space orientation="vertical" style={{ width: '100%' }} size="small">
        <ELInput
          placeholder="Buscar nas perguntas frequentes..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />

        {categories.length > 1 && (
          <ELSegmented
            options={[
              { label: 'Todas', value: 'all' },
              ...categories.map((cat) => ({ label: cat, value: cat })),
            ]}
            value={selectedCategory}
            onChange={(value) => setSelectedCategory(value as string)}
          />
        )}
      </Space>

      {isLoading ? (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <ELSkeleton active lines={2} />
          <ELSkeleton active lines={2} />
          <ELSkeleton active lines={2} />
        </Space>
      ) : displayItems.length === 0 ? (
        <ELEmpty
          message={
            search
              ? 'Nenhuma pergunta encontrada para esta busca'
              : 'Nenhuma pergunta frequente cadastrada'
          }
        />
      ) : (
        <Collapse
          items={collapseItems}
          onChange={handleExpand}
          bordered={false}
          expandIconPlacement="end"
          style={{ background: 'transparent' }}
        />
      )}
    </Space>
  );
}
