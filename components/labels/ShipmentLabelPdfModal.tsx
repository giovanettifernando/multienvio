"use client";

/**
 * Modal para visualização e impressão de etiquetas de um shipment
 * Permite selecionar volumes individuais ou todos de uma vez
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { App, Space, Radio, Spin, Typography } from "antd";
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { ELModal } from "@/components/ui/ELModal";
import { ELButton } from "@/components/ui/ELButton";
import { ELAlert } from "@/components/ui/ELAlert";

export interface ShipmentLabelPdfModalProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Callback ao fechar */
  onClose: () => void;
  /** ID do shipment */
  shipmentId: string;
  /** Código de rastreio (para nome do arquivo) */
  trackingCode?: string;
  /** Volumes do shipment */
  volumes: Array<{
    id: string;
    packageNumber: number;
    weight: number;
  }>;
  /** ID da label associada ao shipment */
  labelId?: string;
}

type VolumeSelection = "all" | string; // "all" ou packageId

export function ShipmentLabelPdfModal({
  open,
  onClose,
  shipmentId,
  trackingCode,
  volumes,
  labelId,
}: ShipmentLabelPdfModalProps) {
  const { message } = App.useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [selectedVolume, setSelectedVolume] = useState<VolumeSelection>("all");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar PDF quando modal abre ou seleção muda
  const loadPdf = useCallback(async () => {
    if (!open || !labelId) return;

    setLoading(true);
    setError(null);

    // Limpar URL anterior
    if (pdfBlobUrl) {
      const baseUrl = pdfBlobUrl.split("#")[0];
      URL.revokeObjectURL(baseUrl);
      setPdfBlobUrl(null);
    }

    try {
      let url: string;

      if (selectedVolume === "all") {
        // Buscar PDF de todos os volumes (etiqueta completa)
        url = `/api/labels/${labelId}/pdf`;
      } else {
        // Buscar PDF de volume individual
        url = `/api/packages/${selectedVolume}/pdf`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Etiqueta não disponível");
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob) + "#navpanes=0&view=FitH";
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("[LABEL_MODAL]", err);
      const errorMsg = err instanceof Error ? err.message : "Erro ao carregar etiqueta";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [open, labelId, selectedVolume, pdfBlobUrl]);

  // Carregar PDF quando abre ou muda seleção
  useEffect(() => {
    if (open && labelId) {
      loadPdf();
    }
  }, [open, labelId, selectedVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpar ao fechar
  useEffect(() => {
    if (!open && pdfBlobUrl) {
      const baseUrl = pdfBlobUrl.split("#")[0];
      URL.revokeObjectURL(baseUrl);
      setPdfBlobUrl(null);
      setSelectedVolume("all");
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Download PDF
  const handleDownload = useCallback(() => {
    if (!pdfBlobUrl) return;

    const link = document.createElement("a");
    link.href = pdfBlobUrl.split("#")[0];

    const volumeSuffix = selectedVolume === "all"
      ? ""
      : `_vol${volumes.find(v => v.id === selectedVolume)?.packageNumber || ""}`;
    link.download = `etiqueta_${trackingCode || shipmentId}${volumeSuffix}.pdf`;
    link.click();
  }, [pdfBlobUrl, selectedVolume, trackingCode, shipmentId, volumes]);

  // Imprimir PDF
  const handlePrint = useCallback(async () => {
    if (!iframeRef.current) return;

    try {
      iframeRef.current.contentWindow?.print();

      // Marcar como impressa
      if (labelId) {
        await fetch(`/api/labels/${labelId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrinted: true }),
        });
      }
    } catch (err) {
      console.error("[LABEL_PRINT]", err);
      message.error("Erro ao imprimir");
    }
  }, [labelId, message]);

  const fileName = trackingCode || shipmentId;

  return (
    <ELModal
      open={open}
      onCancel={onClose}
      title={`Etiquetas - ${fileName}`}
      width={700}
      centered
      footer={
        <Space>
          <ELButton icon={<CloseOutlined />} onClick={onClose}>
            Fechar
          </ELButton>
          <ELButton
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!pdfBlobUrl || loading}
          >
            Download PDF
          </ELButton>
          <ELButton
            variant="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!pdfBlobUrl || loading}
          >
            Imprimir
          </ELButton>
        </Space>
      }
      styles={{
        body: {
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        },
      }}
    >
      {/* Seleção de volumes */}
      {volumes.length > 1 && (
        <div>
          <Typography.Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
            Selecione o volume:
          </Typography.Text>
          <Radio.Group
            value={selectedVolume}
            onChange={(e) => setSelectedVolume(e.target.value)}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <Radio value="all">
              Todos os volumes ({volumes.length})
            </Radio>
            {volumes.map((vol) => (
              <Radio key={vol.id} value={vol.id}>
                Volume {vol.packageNumber} - {vol.weight.toFixed(1)} kg
              </Radio>
            ))}
          </Radio.Group>
        </div>
      )}

      {/* Alerta informativo */}
      <ELAlert
        variant="info"
        title="Configuração de impressão"
        description="Use papel para etiquetas 84.7 x 101.6 mm (padrão Correios). Configure a impressora sem margens e sem ajuste de escala."
      />

      {/* Área de preview */}
      <div
        style={{
          height: "60vh",
          minHeight: 400,
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "#f5f5f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <Spin indicator={<LoadingOutlined spin style={{ fontSize: 32 }} />} tip="Carregando etiqueta..." />
        ) : error ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Typography.Text type="danger">{error}</Typography.Text>
            <br />
            <ELButton style={{ marginTop: 16 }} onClick={loadPdf}>
              Tentar novamente
            </ELButton>
          </div>
        ) : pdfBlobUrl ? (
          <iframe
            ref={iframeRef}
            src={pdfBlobUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
            title="Etiqueta PDF"
          />
        ) : (
          <Typography.Text type="secondary">
            {labelId ? "Selecione um volume para visualizar" : "Etiqueta não disponível"}
          </Typography.Text>
        )}
      </div>
    </ELModal>
  );
}

export default ShipmentLabelPdfModal;
