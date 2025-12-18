"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { App, Space, Spin, Result } from "antd";
import { PrinterOutlined, DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';

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
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHtmlContent(null);

    try {
      const params = new URLSearchParams();
      params.set('dateFrom', dateFrom);
      params.set('dateTo', dateTo);
      if (search) {
        params.set('search', search);
      }

      const response = await fetch(`/api/wallet/statement/pdf?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Erro ao carregar extrato');
      }

      const html = await response.text();
      setHtmlContent(html);
    } catch (err) {
      console.error('Error loading statement:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar extrato');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, search]);

  // Carregar conteúdo HTML quando o modal abrir
  useEffect(() => {
    if (open) {
      loadContent();
    } else {
      // Limpar estado quando fechar
      setHtmlContent(null);
      setError(null);
    }
  }, [open, loadContent]);

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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 16
        }}>
          <Spin size="large" />
          <span style={{ color: '#8c8c8c' }}>Carregando extrato...</span>
        </div>
      );
    }

    if (error) {
      return (
        <Result
          status="error"
          title="Erro ao carregar extrato"
          subTitle={error}
          extra={
            <ELButton icon={<ReloadOutlined />} onClick={loadContent}>
              Tentar novamente
            </ELButton>
          }
        />
      );
    }

    if (htmlContent) {
      return (
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          title="Extrato da Carteira"
        />
      );
    }

    return null;
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
            disabled={!htmlContent}
          >
            Baixar PDF
          </ELButton>
          <ELButton
            variant="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            disabled={!htmlContent}
          >
            Imprimir
          </ELButton>
        </Space>
      }
    >
      {renderContent()}
    </ELModal>
  );
}
