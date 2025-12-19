'use client';

import { useEffect, useState, useRef } from 'react';
import { ELCheckbox, useELApp, ELSpin, ELDivider, ELSpace } from '@/shared/ui';
const Checkbox = ELCheckbox;
const App = { useApp: useELApp };
const Spin = ELSpin;
const Divider = ELDivider;
const Space = ELSpace;
import { PrinterOutlined, DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';

// Lazy load react-barcode para reduzir bundle inicial
const Barcode = dynamic(() => import('react-barcode'), {
  ssr: false,
  loading: () => <div style={{ height: 40, backgroundColor: '#f0f0f0' }} />,
});

export interface LabelDetailData {
  id: string;
  shipmentId: string;
  carrier: string;
  service: string;
  status: string;
  isPrinted: boolean;
  printedAt?: string;
  platformTrackingCode: string;
  carrierTrackingCode?: string | null;
  recipient: {
    name: string;
    document?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    neighborhood?: string | null;
    city: string;
    state: string;
    cep: string;
  };
  sender: {
    name: string;
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    cep: string;
  };
  file?: {
    url?: string | null;
    base64?: string | null;
    contentType?: string | null;
  } | null;
}

export interface LabelPrintModalProps {
  open: boolean;
  labelId: string | null;
  onClose: () => void;
  onPrintStatusChange?: (labelId: string, isPrinted: boolean) => void;
}

// Componente do layout da etiqueta para impressão
function LabelPrintLayout({ data }: { data: LabelDetailData }) {
  const formatCep = (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }
    return cep;
  };

  return (
    <div
      id="label-print-content"
      style={{
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '1.4',
        backgroundColor: '#fff',
        border: '2px solid #000',
      }}
    >
      {/* Linha 1: Logo + Nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: '#1890ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px',
          }}
        >
          EL
        </div>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Envio Legal</span>
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#000' }} />

      {/* Linha 2: Título código Envio Legal */}
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
        Código de rastreio da Envio Legal
      </div>

      {/* Linha 3: Código de rastreio Envio Legal */}
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>
        {data.platformTrackingCode}
      </div>

      {/* Linha 4: Código de barras Envio Legal */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        <Barcode
          value={data.platformTrackingCode}
          width={1.5}
          height={40}
          fontSize={0}
          margin={0}
          displayValue={false}
        />
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#000' }} />

      {/* Linha 5: Título código transportadora */}
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
        Código de rastreio da transportadora
      </div>

      {/* Linha 6: Código de rastreio transportadora */}
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px' }}>
        {data.carrierTrackingCode || 'N/A'}
      </div>

      {/* Linha 7: Código de barras transportadora */}
      {data.carrierTrackingCode && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <Barcode
            value={data.carrierTrackingCode}
            width={1.5}
            height={40}
            fontSize={0}
            margin={0}
            displayValue={false}
          />
        </div>
      )}

      <Divider style={{ margin: '8px 0', borderColor: '#000' }} />

      {/* Linha 8: Título Destinatário */}
      <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>
        Destinatário
      </div>

      {/* Linha 9: Nome destinatário */}
      <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>
        {data.recipient.name.toUpperCase()}
      </div>

      {/* Linha 10: Endereço destinatário */}
      <div style={{ fontSize: '12px', marginBottom: '2px' }}>
        {data.recipient.address || 'Endereço não informado'}
      </div>

      {/* Linha 11: Bairro - Cidade - UF */}
      <div style={{ fontSize: '12px', marginBottom: '2px' }}>
        {[data.recipient.neighborhood, data.recipient.city, data.recipient.state]
          .filter(Boolean)
          .join(' - ')}
      </div>

      {/* Linha 12: CEP destinatário */}
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>
        CEP: {formatCep(data.recipient.cep)}
      </div>

      <Divider style={{ margin: '8px 0', borderColor: '#000' }} />

      {/* Linha 13: Título Remetente */}
      <div style={{ fontSize: '11px', color: '#666', fontWeight: 'bold', marginBottom: '4px' }}>
        Remetente
      </div>

      {/* Linha 14: Nome remetente */}
      <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' }}>
        {data.sender.name.toUpperCase()}
      </div>

      {/* Linha 15: Endereço remetente */}
      <div style={{ fontSize: '11px', marginBottom: '2px' }}>
        {data.sender.address || 'Endereço não informado'}
      </div>

      {/* Linha 16: Bairro - Cidade - UF */}
      <div style={{ fontSize: '11px', marginBottom: '2px' }}>
        {[data.sender.neighborhood, data.sender.city, data.sender.state]
          .filter(Boolean)
          .join(' - ')}
      </div>

      {/* Linha 17: CEP remetente */}
      <div style={{ fontSize: '11px', fontWeight: 'bold' }}>
        CEP: {formatCep(data.sender.cep)}
      </div>
    </div>
  );
}

export function LabelPrintModal({
  open,
  labelId,
  onClose,
  onPrintStatusChange,
}: LabelPrintModalProps) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LabelDetailData | null>(null);
  const [markAsPrinted, setMarkAsPrinted] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Buscar dados da etiqueta
  useEffect(() => {
    if (!open || !labelId) {
      setData(null);
      return;
    }

    async function fetchLabel() {
      setLoading(true);
      try {
        const response = await fetch(`/api/labels/${labelId}`);
        if (!response.ok) {
          throw new Error('Erro ao carregar etiqueta');
        }
        const labelData = await response.json();
        setData(labelData);
        // Pré-selecionar checkbox se ainda não foi impressa
        setMarkAsPrinted(!labelData.isPrinted);
      } catch (error) {
        console.error('[LABEL_FETCH]', error);
        message.error('Erro ao carregar etiqueta');
      } finally {
        setLoading(false);
      }
    }

    fetchLabel();
  }, [open, labelId, message]);

  // Marcar como impressa na API
  const updatePrintStatus = async () => {
    if (!labelId || !markAsPrinted || data?.isPrinted) return;

    try {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrinted: true }),
      });

      if (response.ok) {
        onPrintStatusChange?.(labelId, true);
      }
    } catch (error) {
      console.error('[LABEL_PRINT_STATUS]', error);
    }
  };

  // Imprimir
  const handlePrint = async () => {
    setActionLoading(true);

    try {
      // Criar janela de impressão
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        message.error('Não foi possível abrir a janela de impressão. Verifique se pop-ups estão permitidos.');
        return;
      }

      const content = printRef.current?.innerHTML || '';

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Etiqueta ${data?.platformTrackingCode}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, sans-serif;
                padding: 10mm;
              }
              @media print {
                @page {
                  size: 100mm 150mm;
                  margin: 5mm;
                }
              }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);

      printWindow.document.close();

      // Aguardar carregamento e imprimir
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };

      // Atualizar status se checkbox marcado
      await updatePrintStatus();
      message.success('Etiqueta enviada para impressão');
    } catch (error) {
      console.error('[LABEL_PRINT]', error);
      message.error('Erro ao imprimir etiqueta');
    } finally {
      setActionLoading(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    if (!data) return;

    setActionLoading(true);

    try {
      // Usar html2canvas + jspdf para gerar PDF
      // Por simplicidade, vamos gerar um PDF simples via canvas
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const element = printRef.current;
      if (!element) {
        throw new Error('Elemento não encontrado');
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Criar PDF no tamanho da etiqueta (10x15cm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150],
      });

      const imgWidth = 90;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 5, 5, imgWidth, imgHeight);
      pdf.save(`etiqueta-${data.platformTrackingCode}.pdf`);

      // Atualizar status se checkbox marcado
      await updatePrintStatus();
      message.success('PDF gerado com sucesso');
    } catch (error) {
      console.error('[LABEL_PDF]', error);
      message.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ELModal
      width={480}
      open={open}
      onCancel={onClose}
      title={`Etiqueta ${data?.platformTrackingCode ?? ''}`}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Checkbox
            checked={markAsPrinted}
            onChange={(e) => setMarkAsPrinted(e.target.checked)}
            disabled={data?.isPrinted}
          >
            {data?.isPrinted ? 'Etiqueta já impressa' : 'Marcar etiqueta como impressa'}
          </Checkbox>

          <Space style={{ justifyContent: 'flex-end' }}>
            <ELButton onClick={onClose}>Fechar</ELButton>
            <ELButton
              icon={<DownloadOutlined />}
              onClick={handleDownloadPdf}
              disabled={!data || loading}
              loading={actionLoading}
            >
              Baixar PDF
            </ELButton>
            <ELButton
              variant="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={!data || loading}
              loading={actionLoading}
            >
              Imprimir
            </ELButton>
          </Space>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
          <div style={{ marginTop: 16, color: '#666' }}>Carregando etiqueta...</div>
        </div>
      ) : data ? (
        <div ref={printRef}>
          <LabelPrintLayout data={data} />
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          Etiqueta não encontrada
        </div>
      )}
    </ELModal>
  );
}

export default LabelPrintModal;
