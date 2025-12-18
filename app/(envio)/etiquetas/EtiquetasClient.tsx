'use client';

import { useState, useCallback, useRef } from 'react';
import { App, Spin, Space } from 'antd';
import { PrinterOutlined, DownloadOutlined, CloseOutlined } from '@ant-design/icons';
import { ELModal } from '@/shared/ui/ELModal';
import { LabelsTable } from '@/modules/labels/ui/components/LabelsTable';
import { LabelPrintModal } from '@/modules/labels/ui/components/LabelPrintModal';
import { ShipmentLabelModal, type ShipmentLabelData } from '@/modules/labels/ui/components';
import type { LabelItem, PackageItem } from '@/shared/types/label';
import { PageShell } from '@/shared/ui/PageShell';
import { useQueryClient } from '@tanstack/react-query';
import { ELButton } from '@/shared/ui/ELButton';

// Verificar se é transportadora Correios
function isCorreiosCarrier(carrier: string): boolean {
  const normalized = carrier.toLowerCase();
  return (
    normalized.includes('correios') ||
    normalized.includes('sedex') ||
    normalized.includes('pac') ||
    normalized === 'correios'
  );
}

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

export default function EtiquetasClient() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  const [loadingLabel, setLoadingLabel] = useState(false);

  const handlePrintStatusChange = useCallback((labelId: string, isPrinted: boolean) => {
    queryClient.invalidateQueries({ queryKey: ['labels'] });
  }, [queryClient]);

  // Handler para abrir etiqueta
  const handleOpenLabel = useCallback(async (record: LabelItem) => {
    // Verificar se é Correios
    if (isCorreiosCarrier(record.carrier)) {
      // Para Correios, mostrar PDF no modal
      setLoadingLabel(true);
      try {
        const url = `/api/labels/${record.id}/pdf`;

        // Buscar PDF como blob
        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Etiqueta não disponível');
        }

        // Criar blob URL para o iframe
        // Adiciona #navpanes=0 para esconder o painel de miniaturas do PDF viewer
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob) + '#navpanes=0&view=FitH';

        // Abrir modal com PDF
        setPdfBlobUrl(blobUrl);
        setPdfLabelId(record.id);
        setPdfPackageId(null);
        setPdfFileName(`etiqueta_${record.trackingCode || record.id}`);
        setPdfModalOpen(true);
      } catch (error) {
        console.error('[LABEL_OPEN]', error);
        const errorMsg = error instanceof Error ? error.message : 'Erro ao carregar etiqueta';

        // Fallback: tentar abrir modal alternativo se o PDF não estiver disponível
        if (errorMsg.includes('Pré-postagem não gerada')) {
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
            } else {
              message.error(errorMsg);
            }
          } catch {
            message.error(errorMsg);
          }
        } else {
          message.error(errorMsg);
        }
      } finally {
        setLoadingLabel(false);
      }
    } else {
      // Usar modal legado para outras transportadoras
      setSelectedLabelId(record.id);
      setLegacyModalOpen(true);
    }
  }, [message]);

  // Handler para abrir etiqueta de volume individual
  const handleOpenPackage = useCallback(async (pkg: PackageItem, label: LabelItem) => {
    setLoadingLabel(true);
    try {
      const url = `/api/packages/${pkg.id}/pdf`;

      // Buscar PDF como blob
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Etiqueta não disponível');
      }

      // Criar blob URL para o iframe
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob) + '#navpanes=0&view=FitH';

      // Abrir modal com PDF
      setPdfBlobUrl(blobUrl);
      setPdfLabelId(label.id);
      setPdfPackageId(pkg.id);
      setPdfFileName(`etiqueta_${label.trackingCode || label.id}_vol${pkg.packageNumber}`);
      setPdfModalOpen(true);
    } catch (error) {
      console.error('[PACKAGE_OPEN]', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao carregar etiqueta do volume';
      message.error(errorMsg);
    } finally {
      setLoadingLabel(false);
    }
  }, [message]);

  // Fechar modal PDF e limpar blob URL
  const handleClosePdfModal = useCallback(() => {
    setPdfModalOpen(false);
    if (pdfBlobUrl) {
      // Remove hash fragment antes de revogar o blob URL
      const blobUrlBase = pdfBlobUrl.split('#')[0];
      URL.revokeObjectURL(blobUrlBase);
    }
    setPdfBlobUrl(null);
    setPdfLabelId(null);
    setPdfPackageId(null);
    setPdfFileName('etiqueta');
  }, [pdfBlobUrl]);

  // Download PDF
  const handleDownloadPdf = useCallback(() => {
    if (pdfBlobUrl) {
      const link = document.createElement('a');
      // Remove hash fragment para download
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

        // Marcar como impressa
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
        <Spin spinning={loadingLabel} tip="Carregando etiqueta...">
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
