'use client';

import { useState, useCallback, useEffect } from 'react';
import { App, Spin } from 'antd';
import { LabelsTable } from '@/components/labels/LabelsTable';
import { LabelPrintModal } from '@/components/labels/LabelPrintModal';
import { ShipmentLabelModal, type ShipmentLabelData } from '@/components/labels';
import type { LabelItem } from '@/lib/types/label';
import { PageShell } from '@/components/shared/PageShell';
import { useQueryClient } from '@tanstack/react-query';

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

  // Estado para modal legado (não-Correios)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [legacyModalOpen, setLegacyModalOpen] = useState(false);

  // Estado para modal Correios
  const [correiosModalOpen, setCorreiosModalOpen] = useState(false);
  const [correiosShipment, setCorreiosShipment] = useState<ShipmentLabelData | null>(null);
  const [loadingLabel, setLoadingLabel] = useState(false);

  const handlePrintStatusChange = useCallback((labelId: string, isPrinted: boolean) => {
    queryClient.invalidateQueries({ queryKey: ['labels'] });
  }, [queryClient]);

  // Handler para abrir etiqueta
  const handleOpenLabel = useCallback(async (record: LabelItem) => {
    // Verificar se é Correios
    if (isCorreiosCarrier(record.carrier)) {
      // Buscar dados completos para etiqueta Correios
      setLoadingLabel(true);
      try {
        const response = await fetch(`/api/labels/${record.id}`);
        if (!response.ok) {
          throw new Error('Erro ao carregar etiqueta');
        }
        const data: LabelDetailResponse = await response.json();

        // Converter para formato do ShipmentLabelModal
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
      } catch (error) {
        console.error('[LABEL_OPEN]', error);
        message.error('Erro ao carregar etiqueta');
      } finally {
        setLoadingLabel(false);
      }
    } else {
      // Usar modal legado para outras transportadoras
      setSelectedLabelId(record.id);
      setLegacyModalOpen(true);
    }
  }, [message]);

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
          <LabelsTable onOpenLabel={handleOpenLabel} />
        </Spin>

        {/* Modal legado para transportadoras não-Correios */}
        <LabelPrintModal
          open={legacyModalOpen}
          labelId={selectedLabelId}
          onClose={handleCloseLegacyModal}
          onPrintStatusChange={handlePrintStatusChange}
        />

        {/* Modal Correios com formato oficial */}
        <ShipmentLabelModal
          open={correiosModalOpen}
          shipment={correiosShipment}
          onClose={handleCloseCorreiosModal}
          onPrint={handleCorreiosPrint}
          title="Etiqueta Correios"
        />
      </PageShell>
    </App>
  );
}
