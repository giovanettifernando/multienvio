'use client';

import { ELRadio, ELTypography, ELSpace, ELSpin } from '@/shared/ui';
const Radio = ELRadio;
const Typography = ELTypography;
const Space = ELSpace;
const Spin = ELSpin;
import {
  WalletOutlined,
  QrcodeOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import type { PaymentMethod } from './checkoutTypes';
import { formatCurrency } from './checkoutTypes';

const { Text } = Typography;

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  totalAmount: number;
  itemCount: number;
  balance: number;
  hasInsufficientBalance: boolean;
  savedCardsCount: number;
  isLoading: boolean;
}

export function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
  totalAmount,
  itemCount,
  balance,
  hasInsufficientBalance,
  savedCardsCount,
  isLoading,
}: PaymentMethodSelectorProps) {
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="Carregando métodos de pagamento...">
          <div style={{ minHeight: 100 }} />
        </Spin>
      </div>
    );
  }

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Text strong>Total a pagar: </Text>
        <Text style={{ fontSize: 20, color: '#1890ff' }}>{formatCurrency(totalAmount)}</Text>
      </div>

      <div>
        <Text type="secondary">
          Você está pagando {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
        </Text>
      </div>

      <div>
        <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          Selecione o método de pagamento:
        </Text>
        <Radio.Group
          value={selectedMethod}
          onChange={(e) => onMethodChange(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            {/* Wallet */}
            <Radio value="wallet" disabled={hasInsufficientBalance} style={{ width: '100%' }}>
              <Space>
                <WalletOutlined style={{ fontSize: 20 }} />
                <div>
                  <div>Saldo em carteira</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Saldo disponível: {formatCurrency(balance)}
                  </Text>
                  {hasInsufficientBalance && (
                    <div>
                      <Text type="danger" style={{ fontSize: 12 }}>
                        Saldo insuficiente
                      </Text>
                    </div>
                  )}
                </div>
              </Space>
            </Radio>

            {/* PIX */}
            <Radio value="pix" style={{ width: '100%' }}>
              <Space>
                <QrcodeOutlined style={{ fontSize: 20 }} />
                <div>PIX</div>
              </Space>
            </Radio>

            {/* Credit Card */}
            <Radio value="card" style={{ width: '100%' }}>
              <Space>
                <CreditCardOutlined style={{ fontSize: 20 }} />
                <div>Cartão de crédito</div>
              </Space>
            </Radio>
          </Space>
        </Radio.Group>
      </div>

      {/* Informative messages */}
      {selectedMethod === 'pix' && (
        <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Você receberá um QR Code para realizar o pagamento.
            Após a confirmação, seus envios serão processados automaticamente.
          </Text>
        </div>
      )}

      {selectedMethod === 'wallet' && (
        <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            O valor será debitado imediatamente da sua carteira.
          </Text>
        </div>
      )}

      {selectedMethod === 'card' && (
        <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {savedCardsCount > 0
              ? `Você tem ${savedCardsCount} cartão(ões) salvo(s). Poderá usar um deles ou cadastrar um novo.`
              : 'Você será direcionado para cadastrar os dados do cartão.'}
          </Text>
        </div>
      )}
    </Space>
  );
}
