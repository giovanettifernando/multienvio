"use client";

import React, { useRef, useState } from "react";
import { App, Space } from "antd";
import { PrinterOutlined, DownloadOutlined } from "@ant-design/icons";
import { ELModal } from "@/components/ui/ELModal";
import { ELButton } from "@/components/ui/ELButton";

interface StatementPDFModalProps {
  open: boolean;
  onClose: () => void;
  dateFrom: string;
  dateTo: string;
  search?: string;
}

export default function StatementPDFModal({
  open,
  onClose,
  dateFrom,
  dateTo,
  search,
}: StatementPDFModalProps) {
  const { message } = App.useApp();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Construir URL do PDF com filtros
  const params = new URLSearchParams();
  params.set('dateFrom', dateFrom);
  params.set('dateTo', dateTo);
  if (search) {
    params.set('search', search);
  }
  const pdfUrl = `/api/wallet/statement/pdf?${params.toString()}`;

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.print();
      } catch (error) {
        message.error("Erro ao imprimir. Tente novamente.");
        console.error("Print error:", error);
      }
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Construir URL do endpoint de download (PDF binário)
      const downloadParams = new URLSearchParams();
      downloadParams.set('dateFrom', dateFrom);
      downloadParams.set('dateTo', dateTo);
      if (search) {
        downloadParams.set('search', search);
      }
      const downloadUrl = `/api/wallet/statement/download?${downloadParams.toString()}`;

      // Fazer download direto do PDF via fetch
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        throw new Error("Falha ao gerar PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `extrato-carteira-${dateFrom}-${dateTo}.pdf`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      message.success("Download do PDF iniciado!");
    } catch (error) {
      message.error("Erro ao baixar PDF. Tente novamente.");
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ELModal
      title="Visualização do Extrato"
      open={open}
      onCancel={onClose}
      width="90%"
      style={{ top: 20, maxWidth: 1200 }}
      styles={{ body: { padding: 0, height: 'calc(100vh - 200px)' } }}
      footer={
        <Space>
          <ELButton onClick={onClose}>Fechar</ELButton>
          <ELButton
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            loading={isDownloading}
          >
            Baixar PDF
          </ELButton>
          <ELButton variant="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Imprimir
          </ELButton>
        </Space>
      }
    >
      <iframe
        ref={iframeRef}
        src={pdfUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Extrato da Carteira"
      />
    </ELModal>
  );
}
