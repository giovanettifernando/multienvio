"use client";

import { useState, useMemo } from "react";
import {
  Modal,
  Input,
  Typography,
  Space,
  Alert,
  Flex,
  Tag,
  theme,
} from "antd";
import { ELButton } from "@/components/ui/ELButton";
import {
  EnvironmentOutlined,
  SearchOutlined,
  AimOutlined,
} from "@ant-design/icons";
import type { PickupPoint } from "@/lib/pickup/types";
import type { GeoCoordinates } from "@/lib/utils/geo";
import { matchesSearch } from "@/lib/utils/string";
import { formatDistance } from "@/lib/utils/geo";
import UnitsMap from "./UnitsMap";
import type { Marker } from "./LeafletMapInner";

interface PickupPointWithDistance extends PickupPoint {
  distance?: number;
}

// Normalizar pontos para markers
function toMarkers(points: Array<Record<string, unknown> | PickupPointWithDistance>): Marker[] {
  const markers = points
    .map((p) => {
      const geo = p.geo as { lat?: number | string; lng?: number | string } | undefined | null;
      const fallbackLat = 'lat' in p ? (p as Record<string, unknown>).lat : undefined;
      const fallbackLng = 'lng' in p ? (p as Record<string, unknown>).lng : undefined;

      const latValue = typeof geo?.lat === "string" ? parseFloat(geo.lat) : (geo?.lat ?? fallbackLat) as number;
      const lngValue = typeof geo?.lng === "string" ? parseFloat(geo.lng) : (geo?.lng ?? fallbackLng) as number;

      const marker = {
        id: String(p.id),
        name: (p.nomeFantasia ?? ('name' in p ? p.name : undefined) ?? p.razaoSocial ?? ('alias' in p ? (p as Record<string, unknown>).alias : undefined) ?? "Unidade") as string,
        lat: latValue,
        lng: lngValue,
      };

      // Warning: log pontos sem coordenadas (útil para debug)
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) {
        console.warn('[MapModal] Ponto de coleta sem coordenadas válidas:', {
          id: p.id,
          name: marker.name,
          cep: ('cep' in p ? p.cep : undefined),
          cidade: ('cidade' in p ? p.cidade : undefined),
        });
      }

      return marker;
    })
    .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

  return markers;
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
  const { token } = theme.useToken();
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

  // Converter pontos filtrados para markers normalizados
  const markers = useMemo(() => toMarkers(filteredPoints), [filteredPoints]);

  // Fallback: usar coordenadas do primeiro ponto se origem não disponível
  const mapCenter = useMemo(() => {
    if (originCoords) return originCoords;
    // Fallback: primeiro ponto com geo
    const firstPointWithGeo = filteredPoints.find((p) => p.geo);
    if (firstPointWithGeo?.geo) return firstPointWithGeo.geo;
    // Default: São Paulo centro
    return { lat: -23.5505, lng: -46.6333 };
  }, [originCoords, filteredPoints]);

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
      afterOpenChange={(visible) => {
        if (visible) {
          // Trigger resize event to fix map rendering
          setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        }
      }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* Info sobre origem */}
        {originInfo && (
          <Alert
            type="info"
            showIcon
            icon={<AimOutlined />}
            title={
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
          id="search-map-units"
          name="search-map-units"
          placeholder="Buscar unidade por nome, bairro ou cidade"
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          autoFocus
          aria-label="Buscar unidades no mapa"
        />

        {/* Container com mapa real e lista */}
        <Flex gap={16} style={{ height: '400px' }}>
          {/* Área do mapa com Leaflet */}
          <div
            id="map-container"
            style={{
              flex: 1,
              height: 400,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #d9d9d9',
            }}
          >
            <UnitsMap
              originCenter={mapCenter}
              markers={markers}
              selectedPointId={selectedPointId}
              onPointClick={onSelect}
              open={open}
            />
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
                title="Nenhuma unidade encontrada"
                description="Tente ajustar sua busca."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredPoints.map((point) => (
                  <div
                    key={point.id}
                    style={{
                      padding: '12px 8px',
                      cursor: 'pointer',
                      background:
                        selectedPointId === point.id
                          ? token.colorPrimaryBg
                          : hoveredPointId === point.id
                          ? token.colorBgTextHover
                          : 'transparent',
                      borderRadius: 4,
                      marginBottom: 4,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                    onClick={() => onSelect(point.id)}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                    onKeyDown={(e) => handleKeyDown(e, point.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Selecionar ${point.nomeFantasia || point.razaoSocial}`}
                  >
                    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
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
                        <ELButton
                          variant="primary"
                          size="small"
                          block
                          style={{ marginTop: 8 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(point.id);
                          }}
                        >
                          Selecionar esta unidade
                        </ELButton>
                      )}
                    </Space>
                  </div>
                ))}
              </div>
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
