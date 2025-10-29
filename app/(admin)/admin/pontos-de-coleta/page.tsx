'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Flex, Typography, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import SearchFilters from '@/components/pickup/SearchFilters';
import PointsTable from '@/components/pickup/PointsTable';
import PointDrawer from '@/components/pickup/PointDrawer';
import { usePontos, usePontosActions } from '@/hooks/usePontos';
import { usePontosStore } from '@/stores/pontos';
import type { PickupPointFilters, PickupPoint, PickupPointFormData } from '@/lib/pickup/types';

const { Title } = Typography;

export default function PontosDeColetaPage() {
  const { message } = App.useApp();
  const [filters, setFilters] = useState<PickupPointFilters>({ status: 'all', page: 1, pageSize: 10 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PickupPoint | null>(null);

  // Usar hooks do store Zustand
  const allPoints = usePontos({
    status: filters.status !== 'all' ? filters.status : undefined,
    uf: filters.uf,
    cidade: filters.cidade,
    query: filters.q,
  });

  const { createPoint, updatePoint, deletePoint, toggleStatus } = usePontosActions();
  const subscribeExternal = usePontosStore((s) => s.subscribeExternal);

  // Subscrever a mudanças de outras abas
  useEffect(() => {
    const unsubscribe = subscribeExternal();
    return () => unsubscribe();
  }, [subscribeExternal]);

  // Simular paginação (no frontend)
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPoints = allPoints.slice(startIndex, endIndex);

  const data = {
    items: paginatedPoints,
    total: allPoints.length,
    page,
    pageSize,
  };

  const isLoading = false; // Store é síncrono

  const handleFiltersChange = (newFilters: PickupPointFilters) => {
    setFilters({ ...newFilters, pageSize: filters.pageSize });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters({ ...filters, page, pageSize });
  };

  const handleAdd = () => {
    setEditingPoint(null);
    setDrawerOpen(true);
  };

  const handleEdit = (point: PickupPoint) => {
    setEditingPoint(point);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingPoint(null);
  };

  const handleSubmit = (data: PickupPointFormData) => {
    try {
      if (editingPoint) {
        updatePoint(editingPoint.id, data);
        message.success('Ponto atualizado com sucesso');
      } else {
        createPoint(data);
        message.success('Ponto criado com sucesso');
      }
      handleDrawerClose();
    } catch (error) {
      message.error('Erro ao salvar ponto');
    }
  };

  const handleDelete = (id: string) => {
    try {
      deletePoint(id);
      message.success('Ponto excluído com sucesso');
    } catch (error) {
      message.error('Erro ao excluir ponto');
    }
  };

  const handleToggleStatus = (id: string) => {
    try {
      toggleStatus(id);
      message.success('Status atualizado');
    } catch (error) {
      message.error('Erro ao atualizar status');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Pontos de Coleta
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Adicionar Ponto
        </Button>
      </Flex>

      <Card>
        <SearchFilters onChange={handleFiltersChange} />
        <PointsTable
          data={data}
          loading={isLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
          onPageChange={handlePageChange}
        />
      </Card>

      <PointDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSubmit={handleSubmit}
        loading={false}
        editPoint={editingPoint}
      />
    </div>
  );
}
