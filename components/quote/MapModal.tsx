"use client";

import { useState, useMemo } from "react";
import {
  Modal,
  Input,
  List,
  Typography,
  Space,
  Button,
  Alert,
  Flex,
  Tag,
} from "antd";
import {
  EnvironmentOutlined,
  SearchOutlined,
  AimOutlined,
} from "@ant-design/icons";
import type { PickupPoint } from "@/lib/pickup/types";
import type { GeoCoordinates } from "@/lib/utils/geo";
import { matchesSearch } from "@/lib/utils/string";
import { formatDistance } from "@/lib/utils/geo";

interface PickupPointWithDistance extends PickupPoint {
  distance?: number;
}

interface MapModalProps {
  open: boolean;
  onClose: () => void;
  points: PickupPointWithDistance[];
  originCoords: GeoCoordinates | null | undefined;
  originInfo?: {
    cep?: string;
    cidade?: string;
    uf?: string;
  };
  selectedPointId?: string;
  onSelect: (pointId: string) => void;
}

export function MapModal({
  open,
  onClose,
  points,
  originCoords,
  originInfo,
  selectedPointId,
  onSelect,
}: MapModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  // Filtrar pontos por busca
  const filteredPoints = useMemo(() => {
    if (!searchQuery.trim()) return points;

    return points.filter((p) => {
      const searchableText = [
        p.nomeFantasia,
        p.razaoSocial,
        p.bairro,
        p.cidade,
      ]
        .filter(Boolean)
        .join(' ');
      return matchesSearch(searchableText, searchQuery);
    });
  }, [points, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent, pointId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(pointId);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Mapa de unidades"
      width={900}
      footer={null}
      styles={{ body: { maxHeight: '70vh', overflow: 'hidden' } }}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* Info sobre origem */}
        {originInfo && (
          <Alert
            type="info"
            showIcon
            icon={<AimOutlined />}
            message={
              originCoords
                ? `Origem: ${originInfo.cidade || originInfo.uf || 'Localização detectada'}`
                : 'Localização aproximada — CEP de origem não informado'
            }
            description={
              originInfo.cep
                ? `CEP ${originInfo.cep}`
                : 'As distâncias são aproximadas baseadas nas capitais dos estados.'
            }
          />
        )}

        {/* Barra de pesquisa */}
        <Input
          placeholder="Buscar unidade por nome, bairro ou cidade"
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          autoFocus
          aria-label="Buscar unidades no mapa"
        />

        {/* Container com mapa simulado e lista */}
        <Flex gap={16} style={{ height: '400px' }}>
          {/* Área do mapa (placeholder) */}
          <div
            style={{
              flex: 1,
              background: '#f0f0f0',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #d9d9d9',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Space direction="vertical" align="center">
              <EnvironmentOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
              <Typography.Text type="secondary">
                Mapa interativo
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {filteredPoints.length} {filteredPoints.length === 1 ? 'ponto' : 'pontos'} disponíveis
              </Typography.Text>
            </Space>

            {/* Marcadores simplificados (simulação) */}
            {filteredPoints.slice(0, 8).map((point, index) => (
              <div
                key={point.id}
                style={{
                  position: 'absolute',
                  top: `${15 + (index % 4) * 25}%`,
                  left: `${20 + Math.floor(index / 4) * 45}%`,
                  cursor: 'pointer',
                  transform: hoveredPointId === point.id ? 'scale(1.3)' : 'scale(1)',
                  transition: 'transform 0.2s',
                }}
                onClick={() => onSelect(point.id)}
                onMouseEnter={() => setHoveredPointId(point.id)}
                onMouseLeave={() => setHoveredPointId(null)}
                title={point.nomeFantasia || point.razaoSocial}
              >
                <EnvironmentOutlined
                  style={{
                    fontSize: 28,
                    color:
                      selectedPointId === point.id
                        ? '#1890ff'
                        : hoveredPointId === point.id
                        ? '#40a9ff'
                        : '#ff4d4f',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Lista lateral */}
          <div
            style={{
              width: 320,
              overflowY: 'auto',
              border: '1px solid #d9d9d9',
              borderRadius: 8,
              padding: 8,
            }}
          >
            {filteredPoints.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message="Nenhuma unidade encontrada"
                description="Tente ajustar sua busca."
              />
            ) : (
              <List
                dataSource={filteredPoints}
                renderItem={(point) => (
                  <List.Item
                    key={point.id}
                    style={{
                      padding: '12px 8px',
                      cursor: 'pointer',
                      background:
                        selectedPointId === point.id
                          ? '#e6f7ff'
                          : hoveredPointId === point.id
                          ? '#f5f5f5'
                          : 'transparent',
                      borderRadius: 4,
                      marginBottom: 4,
                    }}
                    onClick={() => onSelect(point.id)}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                    onKeyDown={(e) => handleKeyDown(e, point.id)}
                    tabIndex={0}
                    aria-label={`Selecionar ${point.nomeFantasia || point.razaoSocial}`}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Flex justify="space-between" align="center">
                        <Typography.Text
                          strong
                          ellipsis
                          style={{ maxWidth: '70%' }}
                        >
                          {point.nomeFantasia || point.razaoSocial}
                        </Typography.Text>
                        {point.distance !== undefined && (
                          <Tag color="blue">{formatDistance(point.distance)}</Tag>
                        )}
                      </Flex>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                        ellipsis
                      >
                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                        {point.cidade}/{point.uf}
                      </Typography.Text>
                      {point.bairro && (
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 11 }}
                          ellipsis
                        >
                          {point.bairro}
                        </Typography.Text>
                      )}
                      {selectedPointId === point.id && (
                        <Button
                          type="primary"
                          size="small"
                          block
                          style={{ marginTop: 8 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(point.id);
                          }}
                        >
                          Selecionar esta unidade
                        </Button>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Flex>

        {/* Info rodapé */}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Clique em um marcador ou item da lista para selecionar a unidade.
        </Typography.Text>
      </Space>
    </Modal>
  );
}
