'use client';

import { ELTypography, ELSpace, ELSpin } from '@/shared/ui';
const Typography = ELTypography;
const Space = ELSpace;
const Spin = ELSpin;
import { LoadingOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { MercadoPagoPaymentResult, PixPaymentStatus } from './checkoutTypes';
import { formatCurrency } from './checkoutTypes';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';

const { Text } = Typography;

interface PixPaymentViewProps {
  open: boolean;
  pixData: MercadoPagoPaymentResult;
  pixStatus: PixPaymentStatus;
  pixPolling: boolean;
  pixExpireSeconds: number;
  totalAmount: number;
  itemCount: number;
  onRetry: () => void;
  onCancel: () => void;
  onCopyCode: () => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function PixPaymentView({
  open,
  pixData,
  pixStatus,
  pixPolling,
  pixExpireSeconds,
  totalAmount,
  itemCount,
  onRetry,
  onCancel,
  onCopyCode,
}: PixPaymentViewProps) {
  // Status: PAID
  if (pixStatus === 'paid') {
    return (
      <ELModal
        title="Pagamento Confirmado"
        open={open}
        footer={null}
        closable={false}
        width={500}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Pagamento PIX Confirmado!
          </Typography.Title>
          <Text type="secondary">
            Criando seus envios...
          </Text>
          <div style={{ marginTop: 24 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          </div>
        </div>
      </ELModal>
    );
  }

  // Status: EXPIRED
  if (pixStatus === 'expired') {
    return (
      <ELModal
        title="PIX Expirado"
        open={open}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={
          <Space>
            <ELButton variant="primary" onClick={onRetry}>
              Gerar Novo PIX
            </ELButton>
            <ELButton variant="danger" onClick={onCancel}>
              Cancelar
            </ELButton>
          </Space>
        }
        width={500}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CloseCircleFilled style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            PIX Expirado
          </Typography.Title>
          <Text type="secondary">
            O tempo para pagamento expirou. Você pode gerar um novo código ou cancelar.
          </Text>
        </div>
      </ELModal>
    );
  }

  // Status: PENDING (waiting for payment)
  return (
    <ELModal
      title="Pagamento PIX"
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <ELButton variant="danger" onClick={onCancel}>
          Cancelar Pagamento
        </ELButton>
      }
      width={600}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* Polling status */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          background: '#fffbe6',
          borderRadius: 8,
          border: '1px solid #ffe58f',
        }}>
          {pixPolling && <LoadingOutlined spin style={{ color: '#faad14' }} />}
          <Text style={{ color: '#d48806' }}>
            Aguardando pagamento... {formatTime(pixExpireSeconds)}
          </Text>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
            Escaneie o QR Code abaixo com o app do seu banco:
          </Text>

          {(pixData.payment.pixQrCodeUrl || pixData.payment.pixQrCodeBase64) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                pixData.payment.pixQrCodeUrl ||
                `data:image/png;base64,${pixData.payment.pixQrCodeBase64}`
              }
              alt="QR Code PIX"
              style={{
                width: 280,
                height: 280,
                border: '2px solid #d9d9d9',
                borderRadius: 12,
                padding: 16,
                background: '#fff',
              }}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <Text strong style={{ fontSize: 18 }}>
              {formatCurrency(totalAmount)}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {pixData.transaction.referenceId}
            </Text>
          </div>
        </div>

        <ELAlert
          variant="warning"
          title="PIX Copia e Cola"
          description={
            <div style={{ wordBreak: 'break-all', fontSize: 12 }}>
              {pixData.payment.pixQrCode}
              <br />
              <ELButton
                variant="link"
                size="small"
                onClick={onCopyCode}
                style={{ paddingLeft: 0 }}
              >
                Copiar código
              </ELButton>
            </div>
          }
        />
      </Space>
    </ELModal>
  );
}
