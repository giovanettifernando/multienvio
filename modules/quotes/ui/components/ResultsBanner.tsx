"use client";

import {
  EnvironmentOutlined,
  HomeOutlined,
  InboxOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import { ELCard, ELSpace, ELTag, ELTooltip, ELTypography } from '@/shared/ui';
const Card = ELCard;
const Space = ELSpace;
const Tag = ELTag;
const Tooltip = ELTooltip;
const Typography = ELTypography;
import type { QuoteSummary, QuoteVolume } from '@/shared/types/quote';
import { formatBRL } from '@/shared/utils/format';

type ResultsBannerProps = {
  summary: QuoteSummary;
};

// Formatar volume de forma compacta: 20×20×20 • 10kg
const formatVolumeCompact = (volume: QuoteVolume) => {
  const dims = `${volume.comprimentoCm}×${volume.larguraCm}×${volume.alturaCm}`;
  const weight = `${volume.pesoKg.toFixed(1)}kg`;
  return `${dims}cm • ${weight}`;
};

// Calcular peso cubado (fórmula: C × L × A / 6000)
const calculateCubicWeight = (volume: QuoteVolume) => {
  return (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) / 6000;
};

// Calcular peso cubado total
const calculateTotalCubicWeight = (volumes: QuoteVolume[]) => {
  return volumes.reduce((sum, vol) => sum + calculateCubicWeight(vol), 0);
};

export function ResultsBanner({ summary }: ResultsBannerProps) {
  const volumes = summary.volumes ?? [];
  const nVolumes = volumes.length;
  const totalCubicWeight = calculateTotalCubicWeight(volumes);

  // Determinar origem e destino (considerando logística reversa)
  const isReverse = summary.devolucao ?? false;
  const origemCep = isReverse ? summary.destinoCep : summary.origemCep;
  const origemCidade = isReverse ? summary.destinoCidade : summary.origemCidade;
  const origemUf = isReverse ? summary.destinoUf : summary.origemUf;
  const origemIsDefault = isReverse ? false : summary.origemIsDefault;

  const destinoCep = isReverse ? summary.origemCep : summary.destinoCep;
  const destinoCidade = isReverse ? summary.origemCidade : summary.destinoCidade;
  const destinoUf = isReverse ? summary.origemUf : summary.destinoUf;

  // Volumes para exibir: até 2 primeiros
  const visibleVolumes = volumes.slice(0, 2);
  const remainingVolumes = volumes.slice(2);

  return (
    <Card
      size="small"
      title="Resumo do envio"
      style={{
        background: "#f0f5ff",
        borderColor: "#d6e4ff",
      }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        {/* Origem e Destino em uma linha */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Origem */}
          <Space size={6}>
            <HomeOutlined style={{ fontSize: 16, color: "#0F2A5F" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Origem:</strong> {origemCep}
              {origemCidade && origemUf && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {" "}({origemCidade}/{origemUf})
                </Typography.Text>
              )}
              {origemIsDefault && (
                <Tag color="blue" style={{ fontSize: 11, marginLeft: 6, padding: "0 4px" }}>
                  Padrão
                </Tag>
              )}
            </Typography.Text>
          </Space>

          {/* Destino */}
          <Space size={6}>
            <EnvironmentOutlined style={{ fontSize: 16, color: "#C2410C" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Destino:</strong> {destinoCep}
              {destinoCidade && destinoUf && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {" "}({destinoCidade}/{destinoUf})
                </Typography.Text>
              )}
            </Typography.Text>
          </Space>
        </div>

        {/* Seguro e Volumes em uma linha */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          {/* Seguro */}
          <Space size={6}>
            <SafetyOutlined style={{ fontSize: 16, color: "#15803d" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Seguro:</strong> {summary.seguroValor ? formatBRL(summary.seguroValor) : "—"}
            </Typography.Text>
          </Space>

          {/* Volumes */}
          <Space size={6} align="center">
            <InboxOutlined style={{ fontSize: 16, color: "#1e40af" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Volumes:</strong> {nVolumes}
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {" "}(cubado: {totalCubicWeight.toFixed(2)}kg)
              </Typography.Text>
            </Typography.Text>

            {/* Detalhes dos volumes (chips inline) */}
            {nVolumes > 0 && (
              <>
                {visibleVolumes.map((vol, idx) => (
                  <Tooltip key={vol.id} title={formatVolumeCompact(vol)}>
                    <Tag color="blue" style={{ fontSize: 11, margin: 0, padding: "0 4px" }}>
                      V{idx + 1}
                    </Tag>
                  </Tooltip>
                ))}
                {remainingVolumes.length > 0 && (
                  <Tooltip
                    title={
                      <Space orientation="vertical" size={2}>
                        {remainingVolumes.map((vol, idx) => (
                          <div key={vol.id} style={{ fontSize: 12 }}>
                            V{idx + 3}: {formatVolumeCompact(vol)}
                          </div>
                        ))}
                      </Space>
                    }
                  >
                    <Tag style={{ fontSize: 11, cursor: "help", margin: 0, padding: "0 4px" }}>
                      +{remainingVolumes.length}
                    </Tag>
                  </Tooltip>
                )}
              </>
            )}
          </Space>
        </div>
      </Space>
    </Card>
  );
}
