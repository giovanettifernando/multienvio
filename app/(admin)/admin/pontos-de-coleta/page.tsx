'use client';

import { useState } from 'react';
import { Card, Button, Flex, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import SearchFilters from '@/components/pickup/SearchFilters';
import PointsTable from '@/components/pickup/PointsTable';
import PointDrawer from '@/components/pickup/PointDrawer';
import {
  usePoints,
  useCreatePoint,
  useUpdatePoint,
  useDeletePoint,
  useToggleStatus,
} from '@/lib/pickup/hooks';
import type { PickupPointFilters, PickupPoint, PickupPointFormData } from '@/lib/pickup/types';

const { Title } = Typography;

export default function PontosDeColetaPage() {
  const [filters, setFilters] = useState<PickupPointFilters>({ status: 'all', page: 1, pageSize: 10 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PickupPoint | null>(null);

  const { data, isLoading } = usePoints(filters);
  const createPoint = useCreatePoint();
  const updatePoint = useUpdatePoint();
  const deletePoint = useDeletePoint();
  const toggleStatus = useToggleStatus();

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

  const handleSubmit = async (data: PickupPointFormData) => {
    if (editingPoint) {
      await updatePoint.mutateAsync(
        { id: editingPoint.id, data },
        {
          onSuccess: () => {
            handleDrawerClose();
          },
        }
      );
    } else {
      await createPoint.mutateAsync(data, {
        onSuccess: () => {
          handleDrawerClose();
        },
      });
    }
  };

  const handleDelete = async (id: string) => {
    await deletePoint.mutateAsync(id);
  };

  const handleToggleStatus = async (id: string, newStatus: 'active' | 'blocked') => {
    await toggleStatus.mutateAsync({ id, status: newStatus });
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
        loading={createPoint.isPending || updatePoint.isPending}
        editPoint={editingPoint}
      />
    </div>
  );
}
