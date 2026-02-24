'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PrinterOutlined, DownloadOutlined, CloseOutlined } from '@ant-design/icons';
import { ELModal, ELSpin, ELSpace, ELApp, useELApp } from '@/shared/ui';
const { Spin, Space, App } = { Spin: ELSpin, Space: ELSpace, App: ELApp };
import { LabelsTable } from '@/modules/labels/ui/components/LabelsTable';
import { LabelPrintModal } from '@/modules/labels/ui/components/LabelPrintModal';
import { ShipmentLabelModal, type ShipmentLabelData } from '@/modules/labels/ui/components';
import type { LabelItem, PackageItem } from '@/shared/types/label';
import { PageShell } from '@/shared/ui/PageShell';
import { useQueryClient } from '@tanstack/react-query';
import { ELButton } from '@/shared/ui/ELButton';
import { isCorreiosCarrier } from '@/shared/utils/carrier';
import { useDocumentGeneration } from '@/modules/labels/ui/hooks/useDocumentGeneration';

// Tipo para dados completos da etiqueta retornados pela API
interface LabelDetailResponse {
  id: string;
  shipmentId: string;
  carrier: string;
  service: string;
  serviceCode?: string;
  platformTrackingCode: string;
  carrierTrackingCode?: string;
  recipient: {
    name: string;
    document?: string;
    phone?: string;
    email?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  sender: {
    name: string;
    document?: string;
    phone?: string;
    email?: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  volumes: Array<{
    packageNumber: number;
    pesoKg: number;
    dimensoes: {
      comprimento: number;
      largura: number;
      altura: number;
    };
  }>;
  additionalServices?: {
    ar?: boolean;
    mp?: boolean;
    vd?: number;
    dd?: boolean;
  };
}

const STATUS_MESSAGES: Record<string, string> = {
  queued: 'Preparando geração...',
  pending: 'Na fila de processamento...',
  processing: 'Gerando PDF...',
};

export default function EtiquetasClient() {
  const { message } = useELApp();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { status: docStatus, downloadUrl, error: docError, generate, reset: resetDoc } = useDocumentGeneration();

  // Estado para modal legado (não-Correios)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);

  // Estado para modal Correios (fallback)
  const [correiosModalOpen, setCorreiosModalOpen] = useState(false);
  const [correiosShipment, setCorreiosShipment] = useState<ShipmentLabelData | null>(null);

  // Estado para modal PDF
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLabelId, setPdfLabelId] = useState<string | null>(null);
  const [pdfPackageId, setPdfPackageId] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('etiqueta');

  const isGenerating = docStatus === 'queued' || docStatus === 'pending' || docStatus === 'processing';

  // Quando o download estiver pronto, buscar o blob e mostrar no iframe
  useEffect(() => {
    if (!downloadUrl) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error('Falha ao baixar PDF');
        const blob = await response.blob();
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob) + '#navpanes=0&view=FitH';
        setPdfBlobUrl(blobUrl);
        setPdfModalOpen(true);
      } catch (err) {
        if (!cancelled) {
          message.error('Erro ao carregar PDF gerado');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [downloadUrl, message]);

  // Mostrar erro da geração assíncrona
  useEffect(() => {
    if (docError) {
      message.error(docError);
    }
  }, [docError, message]);

  const handlePrintStatusChange = useCallback((labelId: string, isPrinted: boolean) => {
    queryClient.invalidateQueries({ queryKey: ['labels'] });
  }, [queryClient]);

  // Handler para abrir etiqueta
  const handleOpenLabel = useCallback(async (record: LabelItem) => {
    if (isCorreiosCarrier(record.carrier)) {
      setPdfLabelId(record.id);
      setPdfPackageId(null);
      setPdfFileName(`etiqueta_${record.trackingCode || record.id}`);

      const result = await generate('label', { labelId: record.id });

      // Se falhou e é pré-postagem, tentar fallback
      if (!result) {
        if (docError?.includes('Pré-postagem não gerada')) {
          message.warning('Pré-postagem ainda não gerada. Usando visualização alternativa...');
          try {
            const response = await fetch(`/api/labels/${record.id}`);
            if (response.ok) {
              const data: LabelDetailResponse = await response.json();
              const shipmentData: ShipmentLabelData = {
                id: data.shipmentId,
                carrier: data.carrier,
                serviceCode: data.serviceCode,
                serviceName: data.service,
                trackingCode: data.carrierTrackingCode || data.platformTrackingCode,
                sender: {
                  nome: data.sender.name,
                  logradouro: data.sender.logradouro,
                  numero: data.sender.numero,
                  complemento: data.sender.complemento,
                  bairro: data.sender.bairro,
                  cidade: data.sender.cidade,
                  uf: data.sender.uf,
                  cep: data.sender.cep,
                  telefone: data.sender.phone,
                  documento: data.sender.document,
                },
                recipient: {
                  nome: data.recipient.name,
                  logradouro: data.recipient.logradouro,
                  numero: data.recipient.numero,
                  complemento: data.recipient.complemento,
                  bairro: data.recipient.bairro,
                  cidade: data.recipient.cidade,
                  uf: data.recipient.uf,
                  cep: data.recipient.cep,
                  telefone: data.recipient.phone,
                  documento: data.recipient.document,
                },
                volumes: data.volumes.map((vol) => ({
                  pesoKg: vol.pesoKg,
                  dimensoes: vol.dimensoes,
                })),
                additionalServices: data.additionalServices,
              };
              setCorreiosShipment(shipmentData);
              setCorreiosModalOpen(true);
            }
          } catch {
            // fallback já mostrou warning
          }
        }
      }
    } else {
      setSelectedLabelId(record.id);
      setLegacyModalOpen(true);
    }
  }, [generate, docError, message]);

  // Handler para abrir etiqueta de volume individual
  const handleOpenPackage = useCallback(async (pkg: PackageItem, label: LabelItem) => {
    setPdfLabelId(label.id);
    setPdfPackageId(pkg.id);
    setPdfFileName(`etiqueta_${label.trackingCode || label.id}_vol${pkg.packageNumber}`);
    await generate('package', { packageId: pkg.id });
  }, [generate]);

  // Fechar modal PDF e limpar blob URL
  const handleClosePdfModal = useCallback(() => {
    setPdfModalOpen(false);
    resetDoc();
    if (pdfBlobUrl) {
      const blobUrlBase = pdfBlobUrl.split('#')[0];
      URL.revokeObjectURL(blobUrlBase);
    }
    setPdfBlobUrl(null);
    setPdfLabelId(null);
    setPdfPackageId(null);
    setPdfFileName('etiqueta');
  }, [pdfBlobUrl, resetDoc]);

  // Download PDF
  const handleDownloadPdf = useCallback(() => {
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      link.href = pdfBlobUrl.split('#')[0];
      link.download = `${pdfFileName}.pdf`;
      link.click();
    }
  }, [pdfBlobUrl, pdfFileName]);

  // Imprimir PDF
  const handlePrintPdf = useCallback(async () => {
    if (iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.print();

        if (pdfLabelId) {
          await fetch(`/api/labels/${pdfLabelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isPrinted: true }),
          });
          queryClient.invalidateQueries({ queryKey: ['labels'] });
        }
      } catch (error) {
        console.error('[LABEL_PRINT]', error);
        message.error('Erro ao imprimir');
      }
    }
  }, [pdfLabelId, queryClient, message]);

  const handleCloseCorreiosModal = useCallback(() => {
    setCorreiosModalOpen(false);
    setCorreiosShipment(null);
  }, []);

  const handleCloseLegacyModal = useCallback(() => {
    setLegacyModalOpen(false);
    setSelectedLabelId(null);
  }, []);

  const handleCorreiosPrint = useCallback((shipmentId: string) => {
    // Atualizar status de impressão via API
    queryClient.invalidateQueries({ queryKey: ['labels'] });
  }, [queryClient]);

  return (
    <App>
      <PageShell title="Etiquetas" gap="md">
        <Spin spinning={isGenerating} tip={STATUS_MESSAGES[docStatus] || 'Carregando etiqueta...'}>
          <LabelsTable onOpenLabel={handleOpenLabel} onOpenPackage={handleOpenPackage} />
        </Spin>

        {/* Modal legado para transportadoras não-Correios */}
        <LabelPrintModal
          open={legacyModalOpen}
          labelId={selectedLabelId}
          onClose={handleCloseLegacyModal}
          onPrintStatusChange={handlePrintStatusChange}
        />

        {/* Modal Correios com formato oficial (fallback) */}
        <ShipmentLabelModal
          open={correiosModalOpen}
          shipment={correiosShipment}
          onClose={handleCloseCorreiosModal}
          onPrint={handleCorreiosPrint}
          title="Etiqueta Correios"
        />

        {/* Modal PDF - Etiqueta Envio Legal */}
        <ELModal
          open={pdfModalOpen}
          onCancel={handleClosePdfModal}
          title="Etiqueta de Envio"
          size="md"
          centered
          footer={
            <Space wrap>
              <ELButton icon={<CloseOutlined />} onClick={handleClosePdfModal}>
                Fechar
              </ELButton>
              <ELButton icon={<DownloadOutlined />} onClick={handleDownloadPdf}>
                Download PDF
              </ELButton>
              <ELButton variant="primary" icon={<PrinterOutlined />} onClick={handlePrintPdf}>
                Imprimir
              </ELButton>
            </Space>
          }
          styles={{
            body: {
              padding: 0,
              height: 'min(70vh, 600px)',
              overflow: 'hidden',
            },
          }}
        >
          {pdfBlobUrl && (
            <iframe
              ref={iframeRef}
              src={pdfBlobUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Etiqueta PDF"
            />
          )}
        </ELModal>
      </PageShell>
    </App>
  );
}
