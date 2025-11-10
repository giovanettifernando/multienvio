"use client";

import { Space } from "antd";
import { InboxOutlined, FunctionOutlined } from "@ant-design/icons";
import styles from "@/app/(dashboard)/cotacoes/cotacoes.module.css";

type VolumesTotalizerProps = {
  volumeCount: number;
  totalPesoCubadoKg: number;
};

export function VolumesTotalizer({ volumeCount, totalPesoCubadoKg }: VolumesTotalizerProps) {
  const hasWeight = totalPesoCubadoKg > 0;

  return (
    <div className={styles.resultsBanner} data-testid="results-banner">
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        {/* Linha de volumes */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Space align="center" size={8}>
            <InboxOutlined style={{ fontSize: 14, color: "#1e40af" }} />
            <span className={styles.resultsBannerTitle}>Volumes:</span>
            <span className={styles.resultsBannerValue}>{volumeCount}</span>
          </Space>
        </div>

        {/* Linha de peso cubado */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <Space align="center" size={8}>
            <FunctionOutlined
              style={{
                fontSize: 14,
                color: hasWeight ? "#15803d" : "#64748b",
              }}
            />
            <span className={styles.resultsBannerTitle}>Peso cubado total:</span>
            <span
              className={styles.resultsBannerWeight}
              style={{
                fontSize: 14,
                color: hasWeight ? "#15803d" : "#64748b",
              }}
            >
              {totalPesoCubadoKg.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </span>
          </Space>
        </div>
      </Space>
    </div>
  );
}
