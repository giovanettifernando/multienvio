'use client';

import { useEffect, useState } from 'react';
import { Descriptions, Space, Button, Tabs, Typography, App, Tag } from 'antd';
import { ELModal } from '@/shared/ui/ELModal';
import type { LabelItem } from '@/shared/types/label';
import { createObjectUrlFromLabelFile, printPdfFromIframe, downloadPdf } from '@/shared/utils/pdf';
import dayjs from 'dayjs';

export interface LabelModalProps {
  open: boolean;
  label?: LabelItem | null;
  onClose: () => void;
}

export function LabelModal({ open, label, onClose }: LabelModalProps) {
  const { message } = App.useApp();
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [revoke, setRevoke] = useState<() => void>(() => () => {});

  const canActions = !!(label && label.status === 'issued' && label.file);

  useEffect(() => {
    if (open && label?.file) {
      const { objectUrl, revoke } = createObjectUrlFromLabelFile(label.file);
      setPdfUrl(objectUrl);
      setRevoke(() => revoke);
    }
    return () => { revoke?.(); setPdfUrl(''); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, label?.id]);

  return (
    <ELModal
      size="xl"
      open={open}
      onCancel={onClose}
      title={`Etiqueta ${label?.id ?? ''}`}
      footer={
        <Space>
          <Button onClick={onClose}>Fechar</Button>
          <Button
            type="default"
            disabled={!canActions}
            onClick={() => {
              if (pdfUrl) printPdfFromIframe(pdfUrl);
              else message.warning('PDF não disponível para impressão.');
            }}
          >
            Imprimir
          </Button>
          <Button
            type="primary"
            disabled={!canActions}
            onClick={() => {
              if (label?.file) downloadPdf(`etiqueta-${label.id}.pdf`, label.file);
              else message.warning('PDF não disponível para download.');
            }}
          >
            Baixar PDF
          </Button>
        </Space>
      }
    >
      <Tabs
        defaultActiveKey="preview"
        items={[
          {
            key: 'preview',
            label: 'Pré-visualização',
            children: (
              canActions && pdfUrl ? (
                <iframe
                  title="preview-pdf"
                  src={pdfUrl}
                  style={{ width: '100%', height: 560, border: '1px solid #f0f0f0', borderRadius: 6 }}
                />
              ) : (
                <Typography.Text type="secondary">
                  {canActions
                    ? 'Carregando PDF...'
                    : `PDF indisponível para este status (${label?.status}). A etiqueta precisa estar EMITIDA.`}
                </Typography.Text>
              )
            ),
          },
          {
            key: 'dados',
            label: 'Dados da etiqueta',
            children: (
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="ID Etiqueta">{label?.id}</Descriptions.Item>
                <Descriptions.Item label="Envio">{label?.shipmentId}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  {label ? <Tag>{label.status.toUpperCase()}</Tag> : '-' }
                </Descriptions.Item>
                <Descriptions.Item label="Criada em">
                  {label ? dayjs(label.createdAt).format('DD/MM/YYYY HH:mm') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Transportadora">{label?.carrier}</Descriptions.Item>
                <Descriptions.Item label="Serviço">{label?.service}</Descriptions.Item>
                <Descriptions.Item label="Destinatário">{label?.recipient?.name}</Descriptions.Item>
                <Descriptions.Item label="Documento">{label?.recipient?.document ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="Valor">
                  {label?.price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Descriptions.Item>
                <Descriptions.Item label="Rastreamento">{label?.trackingCode ?? '-'}</Descriptions.Item>
              </Descriptions>
            ),
          },
        ]}
      />
    </ELModal>
  );
}
