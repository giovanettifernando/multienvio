'use client';

import { ELTypography, ELSpace, ELSpin } from '@/shared/ui';
const Typography = ELTypography;
const Space = ELSpace;
const Spin = ELSpin;
import { LoadingOutlined, CheckCircleFilled, CloseCircleFilled, FilePdfOutlined } from '@ant-design/icons';
import type { BoletoPaymentData, PendingPaymentStatus } from './checkoutTypes';
import { formatCurrency } from './checkoutTypes';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';

const { Text } = Typography;

interface BoletoPaymentViewProps {
  open: boolean;
  boletoData: BoletoPaymentData;
  boletoStatus: PendingPaymentStatus;
  boletoPolling: boolean;
  totalAmount: number;
  /** Omitir quando o pagamento não representa "N envios" (ex.: recarga de carteira). */
  itemCount?: number;
  /**
   * Texto do aviso de prazo. Default é a cópia exigida para o fluxo de
   * envio; contextos sem shipment (ex.: recarga de carteira) podem sobrescrever.
   */
  releaseMessage?: string;
  onCancel: () => void;
  onCopyCode: () => void;
}

const DEFAULT_RELEASE_MESSAGE = 'O envio será liberado após a compensação, em até 3 dias úteis';

/**
 * Tela de acompanhamento de boleto — mesma família visual de `PixPaymentView`
 * (Task 15). Diferente do PIX, não há um "retry" natural (o boleto já gerado
 * continua válido até o vencimento), então não existe estado equivalente a
 * "Gerar novo boleto"; ao vencer/cancelar, a única ação é fechar.
 */
export function BoletoPaymentView({
  open,
  boletoData,
  boletoStatus,
  boletoPolling,
  totalAmount,
  itemCount,
  releaseMessage = DEFAULT_RELEASE_MESSAGE,
  onCancel,
  onCopyCode,
}: BoletoPaymentViewProps) {
  // Status: PAID
  if (boletoStatus === 'paid') {
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
            Boleto Compensado!
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

  // Status: EXPIRED (boleto vencido/cancelado/falhou)
  if (boletoStatus === 'expired') {
    return (
      <ELModal
        title="Boleto não confirmado"
        open={open}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={
          <ELButton variant="danger" onClick={onCancel}>
            Fechar
          </ELButton>
        }
        width={500}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CloseCircleFilled style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Boleto não confirmado
          </Typography.Title>
          <Text type="secondary">
            Este boleto venceu ou foi cancelado. Gere um novo boleto para continuar.
          </Text>
        </div>
      </ELModal>
    );
  }

  // Status: PENDING (aguardando compensação)
  return (
    <ELModal
      title="Boleto gerado"
      open={open}
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={
        <ELButton variant="danger" onClick={onCancel}>
          Fechar
        </ELButton>
      }
      width={600}
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* Status de acompanhamento */}
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
          {boletoPolling && <LoadingOutlined spin style={{ color: '#faad14' }} />}
          <Text style={{ color: '#d48806' }}>
            Aguardando compensação...
          </Text>
        </div>

        <ELAlert
          variant="warning"
          title={releaseMessage}
          description={`Vencimento: ${boletoData.dueDate}`}
        />

        <div style={{ textAlign: 'center' }}>
          <Text strong style={{ fontSize: 18 }}>
            {formatCurrency(totalAmount)}
          </Text>
          {itemCount != null && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
              </Text>
            </>
          )}
        </div>

        {boletoData.boletoUrl && (
          <ELButton
            variant="primary"
            block
            icon={<FilePdfOutlined />}
            onClick={() => window.open(boletoData.boletoUrl, '_blank', 'noopener,noreferrer')}
          >
            Abrir boleto em PDF
          </ELButton>
        )}

        <ELAlert
          variant="info"
          title="Linha digitável"
          description={
            <div style={{ wordBreak: 'break-all', fontSize: 12 }}>
              {boletoData.boletoBarcode}
              <br />
              <ELButton
                variant="link"
                size="small"
                onClick={onCopyCode}
                style={{ paddingLeft: 0 }}
              >
                Copiar linha digitável
              </ELButton>
            </div>
          }
        />
      </Space>
    </ELModal>
  );
}
