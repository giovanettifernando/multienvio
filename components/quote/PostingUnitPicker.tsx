"use client";

import { useEffect, useMemo, useState } from "react";
import { EnvironmentOutlined, SearchOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Input,
  List,
  Radio,
  Space,
  Switch,
  Typography,
} from "antd";
import { useFormContext } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { usePontosStore } from "@/stores/pontos";
import { useCheckoutStore } from "@/stores/checkout";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import type { PickupPoint } from "@/lib/pickup/types";
import { matchesSearch } from "@/lib/utils/string";
import { calculateDistance, getUFCoordinates, formatDistance } from "@/lib/utils/geo";
import { MapModal } from "./MapModal";
import { usePickupPoints } from "@/hooks/usePickupPoints";
import { useGeocode } from "@/hooks/useGeocode";
import { PickupPointStatus } from "@/types/contracts";

interface PickupPointWithDistance extends PickupPoint {
  distance?: number;
}

export function PostingUnitPicker() {
  const { pickupAtOrigin, hydrated } = useQuoteDraft(
    useShallow((s) => ({ pickupAtOrigin: s.pickupAtOrigin, hydrated: s._hasHydrated }))
  );
  const results = useQuoteStore((state) => state.results);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);

  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FinalizeFormValues>();

  const selectedUnit = watch("postingUnit.selected");
  const definirComoPadrao = watch("postingUnit.definirComoPadrao");

  // Usar store de pontos ao invés de API
  const points = usePontosStore ((s) => s.points);
  const setDefaultPoint = usePontosStore((s) => s.setDefaultPoint);
  const setCheckoutPickupPoint = useCheckoutStore((s) => s.setPickupPoint);
  const subscribeExternal = usePontosStore((s) => s.subscribeExternal);

  // Buscar todos os pontos de coleta ativos (sem filtro de localização)
  // O usuário pode escolher qualquer ponto cadastrado no sistema
  const { data: apiPickupPoints, isLoading: isLoadingPickupPoints } = usePickupPoints({});

  // Geocodificar CEP de origem para obter coordenadas precisas
  const originCep = results?.resumo?.origemCep;
  const { data: originGeocode } = useGeocode(originCep);

  // Popul ar store com pontos do banco quando carregarem
  useEffect(() => {
    if (apiPickupPoints && apiPickupPoints.length > 0) {
      // Converter pontos da API para formato do store
      const storePoints: PickupPoint[] = apiPickupPoints.map((apiPoint) => ({
        id: apiPoint.id,
        status: PickupPointStatus.ACTIVE,
        razaoSocial: apiPoint.alias,
        nomeFantasia: apiPoint.name,
        cnpj: '', // Não retornado pela API
        ie: null,
        email: null,
        telefone: null,
        cep: apiPoint.cep || null,
        logradouro: apiPoint.address || null,
        numero: apiPoint.number || null,
        complemento: null,
        bairro: apiPoint.neighborhood || null,
        cidade: apiPoint.city || null,
        uf: apiPoint.uf || null,
        geo: apiPoint.lat && apiPoint.lng ? { lat: apiPoint.lat, lng: apiPoint.lng } : null,
        paymentMethod: { kind: 'pix', pixType: 'random', pixKey: '' },
        payoutDay: null,
        minPayoutAmount: null,
        commissionPerItem: null,
        capacityPerDay: null,
        monthlyReceived: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      // Atualizar store com pontos do banco (substituir pontos locais)
      usePontosStore.setState({ points: storePoints });
    }
  }, [apiPickupPoints]);

  // Subscrever a mudanças externas (outras abas)
  useEffect(() => {
    const unsubscribe = subscribeExternal();
    return () => unsubscribe();
  }, [subscribeExternal]);

  // Obter coordenadas da origem para cálculo de distância
  const originCoords = useMemo(() => {
    // Prioridade 1: usar geocodificação real do CEP
    if (originGeocode?.coordinates) {
      return originGeocode.coordinates;
    }

    // Fallback: usar coordenadas da capital do estado
    const uf = results?.resumo?.origemUf;
    if (!uf) return null;
    return getUFCoordinates(uf);
  }, [originGeocode, results?.resumo?.origemUf]);

  // Filtrar, calcular distâncias e ordenar pontos
  const unidades = useMemo(() => {
    // Filtrar apenas ativos
    let filtered: PickupPointWithDistance[] = points
      .filter((p) => p.status === PickupPointStatus.ACTIVE)
      .map((p) => {
        let distance: number | undefined;

        // Calcular distância se houver coordenadas
        if (originCoords) {
          if (p.geo) {
            // Usar geo do ponto se disponível
            distance = calculateDistance(originCoords, p.geo);
          } else if (p.uf) {
            // Fallback: usar coordenadas da capital do estado do ponto
            const pointCoords = getUFCoordinates(p.uf);
            if (pointCoords) {
              distance = calculateDistance(originCoords, pointCoords);
            }
          }
        }

        return { ...p, distance };
      });

    // Aplicar busca textual
    if (searchQuery.trim()) {
      filtered = filtered.filter((p) => {
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
    }

    // Ordenar por distância (se disponível), depois por nome
    filtered.sort((a, b) => {
      // Pontos com distância vêm primeiro
      if (a.distance !== undefined && b.distance === undefined) return -1;
      if (a.distance === undefined && b.distance !== undefined) return 1;

      // Ambos com distância: ordenar por distância
      if (a.distance !== undefined && b.distance !== undefined) {
        if (a.distance !== b.distance) return a.distance - b.distance;
      }

      // Mesma distância ou ambos sem: ordenar por nome
      const nameA = a.nomeFantasia || a.razaoSocial;
      const nameB = b.nomeFantasia || b.razaoSocial;
      return nameA.localeCompare(nameB);
    });

    return filtered;
  }, [points, searchQuery, originCoords]);

  const unidadesDisponiveis = unidades.length;
  const totalPontosAtivos = points.filter((p) => p.status === PickupPointStatus.ACTIVE).length;

  const handleSelect = (pointId: string) => {
    const point = unidades.find((item) => item.id === pointId);
    if (point) {
      // Converter PickupPoint para formato esperado pelo form
      setValue(
        "postingUnit.selected",
        {
          id: point.id,
          nome: point.nomeFantasia || point.razaoSocial,
          endereco: formatEndereco(point),
          cidade: point.cidade || '',
          uf: point.uf || '',
          cep: point.cep || '',
        },
        { shouldDirty: true }
      );
      // Salvar no checkout store
      setCheckoutPickupPoint(point.id);
    }
  };

  const handleMapSelect = (pointId: string) => {
    handleSelect(pointId);
    setMapModalOpen(false);
    // Scroll até o item selecionado após fechar modal
    setTimeout(() => {
      const element = document.getElementById(`pickup-point-${pointId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Aplicar padrão quando checkbox muda
  useEffect(() => {
    if (definirComoPadrao && selectedUnit) {
      setDefaultPoint(selectedUnit.id);
    }
  }, [definirComoPadrao, selectedUnit, setDefaultPoint]);

  // Aguarde hidratação antes de renderizar
  if (!hydrated) {
    return null; // Evita flicker durante carregamento
  }

  // Se coleta na origem está ativa, não exibir bloco
  if (pickupAtOrigin) {
    return null;
  }

  return (
    <>
      <Card title="Unidade de postagem">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Selecione a unidade onde o envio será postado."
          />

          {/* Barra de pesquisa */}
          <Input
            placeholder="Busque por nome, bairro ou cidade"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            aria-label="Buscar pontos de coleta"
            autoComplete="off"
          />

          {/* Contador de resultados */}
          <Typography.Text type="secondary" aria-live="polite" aria-atomic="true">
            {unidadesDisponiveis === 0 && totalPontosAtivos > 0
              ? 'Nenhuma unidade encontrada para os filtros digitados'
              : unidadesDisponiveis === 1
              ? '1 unidade disponível'
              : `${unidadesDisponiveis} unidades disponíveis`}
          </Typography.Text>

          {/* Lista de unidades */}
          {totalPontosAtivos === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="Nenhuma unidade cadastrada."
              description="Cadastre pontos de coleta no Admin."
            />
          ) : unidadesDisponiveis === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Nenhuma unidade encontrada para os filtros digitados."
              description="Tente ajustar sua busca."
            />
          ) : (
            <Radio.Group
              style={{ width: "100%" }}
              value={selectedUnit?.id}
              onChange={(event) => handleSelect(event.target.value)}
            >
              <List
                dataSource={unidades}
                renderItem={(point) => (
                  <List.Item
                    key={point.id}
                    id={`pickup-point-${point.id}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(point.id);
                      }
                    }}
                    aria-label={`Ponto de coleta: ${point.nomeFantasia || point.razaoSocial}`}
                  >
                    <Radio value={point.id} style={{ width: "100%" }}>
                      <Space direction="vertical" size={4} style={{ width: "100%" }}>
                        <Typography.Text strong>
                          {point.nomeFantasia || point.razaoSocial}
                          {point.distance !== undefined && (
                            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                              • {formatDistance(point.distance)}
                            </Typography.Text>
                          )}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          <EnvironmentOutlined style={{ marginRight: 4 }} />
                          {formatEndereco(point)}
                        </Typography.Text>
                      </Space>
                    </Radio>
                  </List.Item>
                )}
              />
            </Radio.Group>
          )}

          {/* Switch definir como padrão */}
          <Space align="center">
            <Switch
              checked={definirComoPadrao}
              disabled={!selectedUnit}
              onChange={(checked) =>
                setValue("postingUnit.definirComoPadrao", checked, {
                  shouldDirty: true,
                })
              }
              aria-label="Definir unidade como padrão"
            />
            <Typography.Text style={{ opacity: selectedUnit ? 1 : 0.5 }}>
              Definir essa unidade como padrão na calculadora
            </Typography.Text>
          </Space>

          {/* Botão ver mapa */}
          <Button
            icon={<EnvironmentOutlined />}
            disabled={totalPontosAtivos === 0}
            onClick={() => setMapModalOpen(true)}
            aria-label="Ver mapa de unidades"
          >
            Ver mapa de unidades
          </Button>

          {/* Erro de validação */}
          {errors.postingUnit?.selected ? (
            <Typography.Text type="danger">
              {(errors.postingUnit.selected as unknown as { message?: string })?.message ??
                "Selecione uma unidade de postagem."}
            </Typography.Text>
          ) : null}
        </Space>
      </Card>

      {/* Modal de mapa */}
      <MapModal
        open={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        points={unidades}
        originCoords={originCoords}
        originInfo={{
          cep: results?.resumo.origemCep,
          cidade: results?.resumo.origemCidade,
          uf: results?.resumo.origemUf,
        }}
        selectedPointId={selectedUnit?.id}
        onSelect={handleMapSelect}
      />
    </>
  );
}

/**
 * Formata endereço completo do ponto
 */
function formatEndereco(point: PickupPoint): string {
  const parts: string[] = [];

  if (point.logradouro) {
    parts.push(`${point.logradouro}${point.numero ? `, ${point.numero}` : ''}`);
  }
  if (point.bairro) parts.push(point.bairro);
  if (point.cidade && point.uf) parts.push(`${point.cidade}/${point.uf}`);
  if (point.cep) parts.push(`CEP ${point.cep}`);

  return parts.join(' — ') || 'Endereço não informado';
}
