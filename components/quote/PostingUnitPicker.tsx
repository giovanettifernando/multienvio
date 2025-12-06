"use client";

import { useEffect, useMemo, useState } from "react";
import { EnvironmentOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Input,
  Radio,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  theme,
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
import { useCorreiosAgencies, type CorreiosAgency } from "@/hooks/useCorreiosAgencies";

interface PickupPointWithDistance extends PickupPoint {
  distance?: number;
}

export function PostingUnitPicker() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { pickupAtOrigin, hydrated } = useQuoteDraft(
    useShallow((s) => ({ pickupAtOrigin: s.pickupAtOrigin, hydrated: s._hasHydrated }))
  );
  const results = useQuoteStore((state) => state.results);
  const selection = useQuoteStore((state) => state.selection);
  const [searchQuery, setSearchQuery] = useState("");
  const [agencySearchQuery, setAgencySearchQuery] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [agencyMapModalOpen, setAgencyMapModalOpen] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [hasFetchedPreferences, setHasFetchedPreferences] = useState(false);

  // Verificar se a transportadora selecionada é Correios
  const isCorreiosCarrier = useMemo(() => {
    const carrier = selection?.result?.carrier;
    return carrier ? carrier.toLowerCase().includes('correios') : false;
  }, [selection?.result?.carrier]);

  // Buscar agências dos Correios quando carrier é Correios
  const originUf = results?.resumo?.origemUf;
  const originMunicipio = results?.resumo?.origemCidade;
  const {
    data: correiosAgenciesData,
    isLoading: isLoadingAgencies,
  } = useCorreiosAgencies({
    uf: originUf,
    municipio: originMunicipio,
    enabled: isCorreiosCarrier && !!originUf,
    limit: 15,
  });

  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FinalizeFormValues>();

  const selectedUnit = watch("postingUnit.selected");
  const definirComoPadrao = watch("postingUnit.definirComoPadrao");

  // Usar store de pontos ao invés de API
  const points = usePontosStore ((s) => s.points);
  const setCheckoutPickupPoint = useCheckoutStore((s) => s.setPickupPoint);
  const subscribeExternal = usePontosStore((s) => s.subscribeExternal);

  // Buscar todos os pontos de coleta ativos (sem filtro de localização)
  // O usuário pode escolher qualquer ponto cadastrado no sistema
  const { data: apiPickupPoints } = usePickupPoints({});

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

  // Carregar unidade padrão do usuário ao montar o componente
  useEffect(() => {
    if (!hasFetchedPreferences && apiPickupPoints && apiPickupPoints.length > 0) {
      const fetchDefaultUnit = async () => {
        try {
          setIsLoadingPreferences(true);
          const response = await fetch("/api/user/preferences");
          if (response.ok) {
            const result = await response.json();
            const defaultUnitId = result.data?.defaultPostingUnitId;

            if (defaultUnitId) {
              // Procurar a unidade padrão nos pontos disponíveis
              const defaultUnit = apiPickupPoints.find((p) => p.id === defaultUnitId);
              if (defaultUnit) {
                // Pré-selecionar a unidade
                setValue(
                  "postingUnit.selected",
                  {
                    id: defaultUnit.id,
                    nome: defaultUnit.name,
                    endereco: `${defaultUnit.address}${defaultUnit.number ? `, ${defaultUnit.number}` : ""}`,
                    cidade: defaultUnit.city || "",
                    uf: defaultUnit.uf || "",
                    cep: defaultUnit.cep || "",
                  },
                  { shouldDirty: false }
                );
                // Ativar o toggle
                setValue("postingUnit.definirComoPadrao", true, { shouldDirty: false });
                // Atualizar checkout store
                setCheckoutPickupPoint(defaultUnit.id);
              }
            }
          }
        } catch (error) {
          console.error("Erro ao carregar unidade padrão:", error);
        } finally {
          setIsLoadingPreferences(false);
          setHasFetchedPreferences(true);
        }
      };

      fetchDefaultUnit();
    }
  }, [apiPickupPoints, hasFetchedPreferences, setValue, setCheckoutPickupPoint]);

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

  // Filtrar agências dos Correios por busca
  const filteredAgencies = useMemo(() => {
    if (!correiosAgenciesData?.agencies) return [];
    if (!agencySearchQuery.trim()) return correiosAgenciesData.agencies;

    const query = agencySearchQuery.toLowerCase();
    return correiosAgenciesData.agencies.filter((agency) => {
      const searchableText = [
        agency.nome,
        agency.bairro,
        agency.municipio,
        agency.logradouro,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(query);
    });
  }, [correiosAgenciesData?.agencies, agencySearchQuery]);

  // Converter agências para formato do mapa
  const agenciesAsMapPoints = useMemo(() => {
    if (!filteredAgencies.length) return [];
    return filteredAgencies.map((agency) => ({
      id: `correios:${agency.id}`,
      status: PickupPointStatus.ACTIVE,
      razaoSocial: agency.nome,
      nomeFantasia: agency.nome,
      cnpj: '',
      ie: null,
      email: null,
      telefone: null,
      cep: agency.cep,
      logradouro: agency.logradouro,
      numero: agency.numero,
      complemento: agency.complemento,
      bairro: agency.bairro,
      cidade: agency.municipio,
      uf: agency.uf,
      geo: agency.latitude && agency.longitude ? { lat: agency.latitude, lng: agency.longitude } : null,
      paymentMethod: { kind: 'pix' as const, pixType: 'random' as const, pixKey: '' },
      payoutDay: null,
      minPayoutAmount: null,
      commissionPerItem: null,
      capacityPerDay: null,
      monthlyReceived: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }, [filteredAgencies]);

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

  // Handler para selecionar agência dos Correios
  const handleSelectCorreiosAgency = (value: string) => {
    // O value vem no formato "correios:{id}"
    const agencyId = value.replace('correios:', '');
    const agency = correiosAgenciesData?.agencies.find((a) => a.id === agencyId);

    if (agency) {
      setValue(
        "postingUnit.selected",
        {
          id: `correios:${agency.id}`,
          nome: agency.nome,
          endereco: agency.enderecoCompleto,
          cidade: agency.municipio,
          uf: agency.uf,
          cep: agency.cep,
        },
        { shouldDirty: true }
      );
      // Para agência dos Correios, não salvar no checkout store (é opcional/informativo)
      // O usuário leva o pacote diretamente na agência
      setCheckoutPickupPoint(null);
    }
  };

  // Handler para selecionar agência no mapa
  const handleAgencyMapSelect = (pointId: string) => {
    handleSelectCorreiosAgency(pointId);
    setAgencyMapModalOpen(false);
  };

  // Persistir unidade padrão quando toggle muda
  useEffect(() => {
    // Não executar durante carregamento inicial
    if (isLoadingPreferences || !hasFetchedPreferences) {
      return;
    }

    const updateDefaultUnit = async () => {
      try {
        const defaultUnitId = definirComoPadrao && selectedUnit ? selectedUnit.id : null;

        const response = await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultPostingUnitId: defaultUnitId }),
        });

        if (!response.ok) {
          message.error("Não foi possível salvar a preferência");
        }
      } catch (error) {
        console.error("Erro ao salvar unidade padrão:", error);
        message.error("Erro ao salvar a preferência");
      }
    };

    updateDefaultUnit();
  }, [definirComoPadrao, selectedUnit, isLoadingPreferences, hasFetchedPreferences, message]);

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
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          {/* Barra de pesquisa */}
          <Input
            id="search-posting-units"
            name="search-posting-units"
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
              title="Nenhuma unidade cadastrada."
              description="Cadastre pontos de coleta no Admin."
            />
          ) : unidadesDisponiveis === 0 ? (
            <Alert
              type="info"
              showIcon
              title="Nenhuma unidade encontrada para os filtros digitados."
              description="Tente ajustar sua busca."
            />
          ) : (
            <Radio.Group
              style={{ width: "100%" }}
              value={selectedUnit?.id}
              onChange={(event) => handleSelect(event.target.value)}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                {unidades.map((point) => (
                  <div
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
                    style={{
                      padding: `${token.paddingSM}px 0`,
                      borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    }}
                  >
                    <Radio value={point.id} style={{ width: "100%" }}>
                      <Space orientation="vertical" size={4} style={{ width: "100%" }}>
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
                  </div>
                ))}
              </div>
            </Radio.Group>
          )}

          {/* Switch definir como padrão */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: !selectedUnit ? "not-allowed" : "pointer" }}>
            <Switch
              checked={definirComoPadrao}
              disabled={!selectedUnit}
              onChange={(checked) =>
                setValue("postingUnit.definirComoPadrao", checked, {
                  shouldDirty: true,
                })
              }
            />
            <Typography.Text style={{ opacity: selectedUnit ? 1 : 0.5 }}>
              Definir como unidade padrão
            </Typography.Text>
          </label>

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

      {/* Card separado para Agências dos Correios (quando carrier é Correios) */}
      {isCorreiosCarrier && (
        <Card
          title={
            <Space>
              <ShopOutlined />
              <span>Agências dos Correios</span>
            </Space>
          }
          style={{ marginTop: 16 }}
        >
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {/* Barra de pesquisa */}
            <Input
              id="search-correios-agencies"
              name="search-correios-agencies"
              placeholder="Busque por nome, bairro ou endereço"
              prefix={<SearchOutlined />}
              value={agencySearchQuery}
              onChange={(e) => setAgencySearchQuery(e.target.value)}
              allowClear
              aria-label="Buscar agências dos Correios"
              autoComplete="off"
            />

            {isLoadingAgencies ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <Spin size="small" />
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  Buscando agências próximas...
                </Typography.Text>
              </div>
            ) : correiosAgenciesData?.agencies && correiosAgenciesData.agencies.length > 0 ? (
              <>
                {/* Contador de resultados */}
                <Typography.Text type="secondary">
                  {filteredAgencies.length === 0
                    ? 'Nenhuma agência encontrada para a busca'
                    : filteredAgencies.length === 1
                    ? '1 agência disponível'
                    : `${filteredAgencies.length} agências disponíveis`}
                </Typography.Text>

                {filteredAgencies.length > 0 ? (
                  <Radio.Group
                    style={{ width: "100%" }}
                    value={selectedUnit?.id}
                    onChange={(event) => handleSelectCorreiosAgency(event.target.value)}
                  >
                    <div style={{ display: "flex", flexDirection: "column", maxHeight: 300, overflowY: 'auto' }}>
                      {filteredAgencies.map((agency) => (
                        <div
                          key={agency.id}
                          style={{
                            padding: `${token.paddingSM}px 0`,
                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                          }}
                        >
                          <Radio value={`correios:${agency.id}`} style={{ width: "100%" }}>
                            <Space direction="vertical" size={4} style={{ width: "100%" }}>
                              <Typography.Text strong>
                                {agency.nome}
                                <Tag color="gold" style={{ marginLeft: 8 }}>
                                  {agency.tipoUnidadeSigla}
                                </Tag>
                              </Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                <EnvironmentOutlined style={{ marginRight: 4 }} />
                                {agency.enderecoCompleto}
                              </Typography.Text>
                              {agency.iniExpediente && agency.fimExpediente && (
                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                  Horário: {agency.iniExpediente} - {agency.fimExpediente}
                                </Typography.Text>
                              )}
                            </Space>
                          </Radio>
                        </div>
                      ))}
                    </div>
                  </Radio.Group>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    message="Nenhuma agência encontrada para a busca"
                    description="Tente ajustar os termos de pesquisa."
                  />
                )}

                {/* Botão ver mapa */}
                <Button
                  icon={<EnvironmentOutlined />}
                  disabled={filteredAgencies.length === 0}
                  onClick={() => setAgencyMapModalOpen(true)}
                  aria-label="Ver mapa de agências"
                >
                  Ver mapa de agências
                </Button>
              </>
            ) : (
              <Alert
                type="info"
                showIcon
                message={`Nenhuma agência encontrada em ${originMunicipio}/${originUf}`}
                description="Você pode postar em qualquer agência dos Correios."
              />
            )}
          </Space>
        </Card>
      )}

      {/* Modal de mapa - Unidades de postagem */}
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

      {/* Modal de mapa - Agências dos Correios */}
      <MapModal
        open={agencyMapModalOpen}
        onClose={() => setAgencyMapModalOpen(false)}
        points={agenciesAsMapPoints}
        originCoords={originCoords}
        originInfo={{
          cep: results?.resumo.origemCep,
          cidade: results?.resumo.origemCidade,
          uf: results?.resumo.origemUf,
        }}
        selectedPointId={selectedUnit?.id}
        onSelect={handleAgencyMapSelect}
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
