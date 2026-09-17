"use client";

/**
 * Onde postar o pacote.
 *
 * Quem leva a encomenda até a transportadora é o próprio cliente, então este
 * card só ajuda a achar onde postar: as agências dos Correios próximas da
 * origem, ou o link do Loggi Ponto quando o serviço escolhido é de postagem.
 * Não há escolha a fazer aqui — nada é gravado no envio.
 *
 * O card segue ocultado do checkout a pedido do produto (ver FinalizarClient);
 * para reativar, basta importar o componente de volta na tela.
 */

import { useMemo, useState } from "react";
import { EnvironmentOutlined, SearchOutlined, ShopOutlined } from "@ant-design/icons";
import {
  ELAlert,
  ELInput,
  ELSpace,
  ELSpin,
  ELTag,
  ELTypography,
  useELTheme,
} from '@/shared/ui';
const Alert = ELAlert;
const Input = ELInput;
const Space = ELSpace;
const Spin = ELSpin;
const Tag = ELTag;
const Typography = ELTypography;
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { useQuoteStore } from '@/modules/quotes/ui/state/useQuoteStore';
import { matchesSearch } from "@/shared/utils/string";
import { isCorreiosCarrier, isLoggiCarrier } from '@/shared/utils/carrier';
import { getUFCoordinates } from "@/shared/utils/geo";
import { MapModal, type MapPoint } from "./MapModal";
import { useGeocode } from "@/shared/hooks";
import { useCorreiosAgencies } from "@/modules/quotes/ui/hooks";

export function PostingUnitPicker() {
  const { token } = useELTheme();
  const results = useQuoteStore((state) => state.results);
  const selection = useQuoteStore((state) => state.selection);
  const [agencySearchQuery, setAgencySearchQuery] = useState("");
  const [agencyMapModalOpen, setAgencyMapModalOpen] = useState(false);

  // Verificar se a transportadora selecionada é Correios
  const isCorreios = useMemo(() => isCorreiosCarrier(selection?.result?.carrier ?? null), [selection?.result?.carrier]);

  // Verificar se é Loggi com serviço de postagem (drop-off)
  const isLoggi = useMemo(() => isLoggiCarrier(selection?.result?.carrier ?? null), [selection?.result?.carrier]);
  const isLoggiDropoff = useMemo(() => isLoggi && (selection?.result?.id?.includes('dropoff') ?? false), [isLoggi, selection?.result?.id]);

  // Buscar agências dos Correios quando carrier é Correios
  const originUf = results?.resumo?.origemUf;
  const originMunicipio = results?.resumo?.origemCidade;
  const {
    data: correiosAgenciesData,
    isLoading: isLoadingAgencies,
  } = useCorreiosAgencies({
    uf: originUf,
    municipio: originMunicipio,
    enabled: isCorreios && !!originUf,
    limit: 50,
  });

  const originCep = results?.resumo?.origemCep;
  const { data: originGeocode } = useGeocode(originCep);

  // Obter coordenadas da origem para centralizar o mapa
  const originCoords = useMemo(() => {
    // Prioridade 1: usar geocodificação real do CEP
    if (originGeocode?.coordinates) {
      return originGeocode.coordinates;
    }

    // Fallback: usar coordenadas da capital do estado
    if (!originUf) return null;
    return getUFCoordinates(originUf);
  }, [originGeocode, originUf]);

  const agencies = correiosAgenciesData?.agencies;

  // Filtrar agências pela busca
  const filteredAgencies = useMemo(() => {
    if (!agencies) return [];
    if (!agencySearchQuery.trim()) return agencies;

    return agencies.filter((agency) => {
      const searchableText = [
        agency.nome,
        agency.bairro,
        agency.municipio,
        agency.logradouro,
      ]
        .filter(Boolean)
        .join(' ');
      return matchesSearch(searchableText, agencySearchQuery);
    });
  }, [agencies, agencySearchQuery]);

  // Converter agências para formato do mapa
  const agenciesAsMapPoints = useMemo<MapPoint[]>(() => {
    return filteredAgencies.map((agency) => ({
      id: `correios:${agency.id}`,
      razaoSocial: agency.nome,
      nomeFantasia: agency.nome,
      bairro: agency.bairro,
      cidade: agency.municipio,
      uf: agency.uf,
      geo: agency.latitude && agency.longitude ? { lat: agency.latitude, lng: agency.longitude } : null,
    }));
  }, [filteredAgencies]);

  // Loggi com postagem (drop-off): exibir mensagem informativa com link
  if (isLoggiDropoff) {
    return (
      <ELCard header={{ title: "Unidade de postagem" }}>
        <Alert
          type="info"
          showIcon
          message="Encontre o Loggi Ponto mais próximo"
          description={
            <span>
              Para postar seu pacote, consulte o{' '}
              <a
                href="https://www.loggi.com/loggiponto/#loggi-ponto"
                target="_blank"
                rel="noopener noreferrer"
              >
                site da Loggi
              </a>
              {' '}e encontre a unidade de postagem mais próxima do seu endereço.
            </span>
          }
        />
      </ELCard>
    );
  }

  if (!isCorreios) {
    return null;
  }

  return (
    <div>
      <ELCard
        header={{
          title: (
            <Space>
              <ShopOutlined />
              <span>Agências dos Correios próximas</span>
              <Tag color="blue">Informativo</Tag>
            </Space>
          ),
        }}
      >
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
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
                <div style={{ display: "flex", flexDirection: "column", maxHeight: 300, overflowY: 'auto' }}>
                  {filteredAgencies.map((agency) => (
                    <div
                      key={agency.id}
                      style={{
                        padding: `${token.paddingSM}px 0`,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      <Space orientation="vertical" size={4} style={{ width: "100%" }}>
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
                    </div>
                  ))}
                </div>
              ) : (
                <Alert
                  type="info"
                  showIcon
                  message="Nenhuma agência encontrada para a busca"
                  description="Tente ajustar os termos de pesquisa."
                />
              )}

              {/* Botão ver mapa */}
              <ELButton
                icon={<EnvironmentOutlined />}
                disabled={filteredAgencies.length === 0}
                onClick={() => setAgencyMapModalOpen(true)}
                aria-label="Ver mapa de agências"
              >
                Ver mapa de agências
              </ELButton>
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
      </ELCard>

      {/* Modal de mapa - Agências dos Correios (apenas visualização) */}
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
        selectedPointId={undefined}
        onSelect={() => setAgencyMapModalOpen(false)}
      />
    </div>
  );
}
