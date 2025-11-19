"use client";

import {
  EnvironmentOutlined,
  HomeOutlined,
  InboxOutlined,
  SafetyOutlined,
  FunctionOutlined,
} from "@ant-design/icons";
import {
  Card,
  Col,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { QuoteSummary, QuoteVolume } from "@/types/quote";
import styles from "@/app/(dashboard)/cotacoes/cotacoes.module.css";

type ResultsBannerProps = {
  summary: QuoteSummary;
};

// Formatar volume de forma compacta: 20×20×20 • 10kg
const formatVolumeCompact = (volume: QuoteVolume) => {
  const dims = `${volume.comprimentoCm}×${volume.larguraCm}×${volume.alturaCm} cm`;
  const weight = `${volume.pesoKg.toFixed(2)} kg`;
  return `${dims} • ${weight}`;
};

// Calcular peso cubado (fórmula: C × L × A / 6000)
const calculateCubicWeight = (volume: QuoteVolume) => {
  return (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) / 6000;
};

// Calcular peso cubado total
const calculateTotalCubicWeight = (volumes: QuoteVolume[]) => {
  return volumes.reduce((sum, vol) => sum + calculateCubicWeight(vol), 0);
};

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
      style={{
        background: "#f0f5ff",
        borderColor: "#d6e4ff",
      }}
      styles={{ body: { padding: 16 } }}
    >
      <Row gutter={[16, 12]}>
        {/* Coluna 1 - Origem */}
        <Col xs={24} sm={12} lg={6}>
          <Space direction="vertical" size={4}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Origem
            </Typography.Text>
            <Space align="start" size={8}>
              <HomeOutlined style={{ fontSize: 16, marginTop: 2 }} />
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {origemCep}
                </Typography.Text>
                {origemCidade && origemUf ? (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {origemCidade} / {origemUf}
                    </Typography.Text>
                  </div>
                ) : null}
                {origemIsDefault ? (
                  <div style={{ marginTop: 4 }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>
                      Meu endereço
                    </Tag>
                  </div>
                ) : null}
              </div>
            </Space>
          </Space>
        </Col>

        {/* Coluna 2 - Destino */}
        <Col xs={24} sm={12} lg={6}>
          <Space direction="vertical" size={4}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Destino
            </Typography.Text>
            <Space align="start" size={8}>
              <EnvironmentOutlined style={{ fontSize: 16, marginTop: 2 }} />
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {destinoCep}
                </Typography.Text>
                {destinoCidade && destinoUf ? (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {destinoCidade} / {destinoUf}
                    </Typography.Text>
                  </div>
                ) : null}
              </div>
            </Space>
          </Space>
        </Col>

        {/* Coluna 3 - Seguro declarado */}
        <Col xs={24} sm={12} lg={6}>
          <Space direction="vertical" size={4}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Seguro declarado
            </Typography.Text>
            <Space align="start" size={8}>
              <SafetyOutlined style={{ fontSize: 16, marginTop: 2 }} />
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {formatCurrency(summary.seguroValor ?? null)}
                </Typography.Text>
              </div>
            </Space>
          </Space>
        </Col>

        {/* Coluna 4 - Volumes */}
        <Col xs={24} sm={12} lg={6}>
          <Space direction="vertical" size={4}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Volumes
            </Typography.Text>
            <div
              className={styles.resultsBanner}
              data-testid="results-banner"
            >
              <Space
                direction="vertical"
                size={6}
                style={{ width: "100%" }}
              >
                {/* Linha de volumes */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Space align="center" size={8}>
                    <InboxOutlined style={{ fontSize: 14, color: "#1e40af" }} />
                    <span className={styles.resultsBannerTitle}>
                      Volumes:
                    </span>
                    <span className={styles.resultsBannerValue}>
                      {nVolumes}
                    </span>
                  </Space>
                </div>

                {/* Linha de peso cubado */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Space align="center" size={8}>
                    <FunctionOutlined
                      style={{
                        fontSize: 14,
                        color: totalCubicWeight > 0 ? "#15803d" : "#64748b",
                      }}
                    />
                    <span className={styles.resultsBannerTitle}>
                      Peso cubado total:
                    </span>
                    <span
                      className={styles.resultsBannerWeight}
                      style={{
                        fontSize: 14,
                        color: totalCubicWeight > 0 ? "#15803d" : "#64748b",
                      }}
                    >
                      {totalCubicWeight.toFixed(2)} kg
                    </span>
                  </Space>
                </div>

                {/* Detalhes dos volumes (chips) */}
                {nVolumes > 1 && (
                  <div style={{ marginTop: 4 }}>
                    <Space
                      direction="vertical"
                      size={4}
                      style={{ width: "100%" }}
                    >
                      {visibleVolumes.map((vol, idx) => (
                        <Tag
                          key={vol.id}
                          color="blue"
                          style={{ fontSize: 11, margin: 0 }}
                        >
                          V{idx + 1}: {formatVolumeCompact(vol)}
                        </Tag>
                      ))}
                      {remainingVolumes.length > 0 ? (
                        <Tooltip
                          title={
                            <Space direction="vertical" size={4}>
                              {remainingVolumes.map((vol, idx) => (
                                <div key={vol.id}>
                                  V{idx + 3}: {formatVolumeCompact(vol)}
                                </div>
                              ))}
                            </Space>
                          }
                        >
                          <Tag
                            style={{
                              fontSize: 11,
                              cursor: "help",
                              margin: 0,
                            }}
                          >
                            +{remainingVolumes.length}{" "}
                            {remainingVolumes.length === 1
                              ? "volume"
                              : "volumes"}
                          </Tag>
                        </Tooltip>
                      ) : null}
                    </Space>
                  </div>
                )}
              </Space>
            </div>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
