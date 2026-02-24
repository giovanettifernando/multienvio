"use client";

/**
 * Modal para visualização e impressão de etiquetas de um shipment
 * Permite selecionar volumes individuais ou todos de uma vez
 * A declaração de conteúdo (quando aplicável) é incluída automaticamente no PDF
 * Usa geração assíncrona via fila BullMQ com polling de status
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { ELApp, ELSpace, ELRadio, ELSpin, ELTypography } from "@/shared/ui";
const App = ELApp;
const Space = ELSpace;
const Radio = ELRadio;
const Spin = ELSpin;
const Typography = ELTypography;
import {
  PrinterOutlined,
  DownloadOutlined,
  CloseOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import { useDocumentGeneration } from "../hooks/useDocumentGeneration";

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
  /** Se o envio possui declaração de conteúdo (incluída automaticamente no PDF) */
  hasDeclaration?: boolean;
}

type VolumeSelection = "all" | string; // "all" ou packageId

export function ShipmentLabelPdfModal({
  open,
  onClose,
  shipmentId,
  trackingCode,
  volumes,
  labelId,
  hasDeclaration = false,
}: ShipmentLabelPdfModalProps) {
  const { message } = App.useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Estados
  const [selectedVolume, setSelectedVolume] = useState<VolumeSelection>("all");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Geração assíncrona via fila
  const { status, downloadUrl, error, generate, reset } = useDocumentGeneration();
  const loading = status === "queued" || status === "pending" || status === "processing";

  // Quando downloadUrl estiver disponível, baixar blob para preview no iframe
  useEffect(() => {
    if (!downloadUrl) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error("Erro ao baixar PDF gerado");
        const blob = await response.blob();
        if (cancelled) return;
        setPdfBlobUrl(URL.createObjectURL(blob) + "#navpanes=0&view=FitH");
      } catch (err) {
        console.error("[LABEL_MODAL] download error", err);
      }
    })();

    return () => { cancelled = true; };
  }, [downloadUrl]);

  // Carregar PDF quando modal abre ou seleção muda
  const loadPdf = useCallback(async () => {
    if (!open || !labelId) return;

    // Limpar URL anterior
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl.split("#")[0]);
      setPdfBlobUrl(null);
    }

    if (selectedVolume === "all") {
      await generate("label", { labelId });
    } else {
      await generate("package", { packageId: selectedVolume });
    }
  }, [open, labelId, selectedVolume, pdfBlobUrl, generate]);

  // Carregar PDF quando abre ou muda seleção
  useEffect(() => {
    if (open && labelId) {
      loadPdf();
    }
  }, [open, labelId, selectedVolume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl.split("#")[0]);
        setPdfBlobUrl(null);
      }
      setSelectedVolume("all");
      reset();
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

  // Imprimir
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
        description={
          hasDeclaration
            ? "Etiqueta inclui Declaração de Conteúdo. Use papel para etiquetas 84.7 x 101.6 mm (padrão Correios). Configure a impressora sem margens."
            : "Use papel para etiquetas 84.7 x 101.6 mm (padrão Correios). Configure a impressora sem margens e sem ajuste de escala."
        }
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
          <div style={{ textAlign: "center" }}>
            <Spin indicator={<LoadingOutlined spin style={{ fontSize: 32 }} />} />
            <div style={{ marginTop: 12, color: "#666" }}>
              {status === "queued" && "Preparando geração..."}
              {status === "pending" && "Na fila de processamento..."}
              {status === "processing" && "Gerando PDF..."}
            </div>
          </div>
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
