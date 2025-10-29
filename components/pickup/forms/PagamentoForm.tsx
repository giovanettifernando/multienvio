'use client';

import { Form, Input, Select, Radio, InputNumber, Row, Col } from 'antd';
import { Controller, Control, FieldErrors, UseFormWatch } from 'react-hook-form';
import { maskCNPJ, maskCPF, unmaskDigits } from '@/lib/pickup/masks';
import type { PickupPointFormData } from '@/lib/pickup/types';

interface PagamentoFormProps {
  control: Control<PickupPointFormData>;
  errors: FieldErrors<PickupPointFormData>;
  watch: UseFormWatch<PickupPointFormData>;
}

export default function PagamentoForm({ control, errors, watch }: PagamentoFormProps) {
  const paymentMethod = watch('paymentMethod');
  const paymentKind = paymentMethod?.kind || 'pix';

  return (
    <div style={{ padding: '16px 0' }}>
      <Form layout="vertical">
        <Form.Item label="Método de Pagamento" required>
          <Controller
            name="paymentMethod.kind"
            control={control}
            render={({ field }) => (
              <Radio.Group
                {...field}
                buttonStyle="solid"
                aria-label="Método de Pagamento"
              >
                <Radio.Button value="pix">PIX</Radio.Button>
                <Radio.Button value="transfer">Transferência Bancária</Radio.Button>
              </Radio.Group>
            )}
          />
        </Form.Item>

        {paymentKind === 'pix' && (
          <>
            <Form.Item label="Tipo de Chave PIX" required>
              <Controller
                name="paymentMethod.pixType"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    placeholder="Selecione o tipo de chave"
                    options={[
                      { label: 'CPF', value: 'cpf' },
                      { label: 'CNPJ', value: 'cnpj' },
                      { label: 'E-mail', value: 'email' },
                      { label: 'Telefone', value: 'phone' },
                      { label: 'Chave Aleatória', value: 'random' },
                    ]}
                    aria-label="Tipo de Chave PIX"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Chave PIX" required>
              <Controller
                name="paymentMethod.pixKey"
                control={control}
                render={({ field }) => {
                  const pixType = watch('paymentMethod.pixType');

                  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    let value = e.target.value;

                    if (pixType === 'cpf') {
                      value = maskCPF(value);
                    } else if (pixType === 'cnpj') {
                      value = maskCNPJ(value);
                    } else if (pixType === 'phone') {
                      value = unmaskDigits(value);
                    }

                    field.onChange(value);
                  };

                  return (
                    <Input
                      {...field}
                      placeholder={
                        pixType === 'email'
                          ? 'email@exemplo.com'
                          : pixType === 'phone'
                          ? '+5511999999999'
                          : pixType === 'cpf'
                          ? '000.000.000-00'
                          : pixType === 'cnpj'
                          ? '00.000.000/0000-00'
                          : 'Chave PIX aleatória'
                      }
                      onChange={handleChange}
                      aria-label="Chave PIX"
                    />
                  );
                }}
              />
            </Form.Item>
          </>
        )}

        {paymentKind === 'transfer' && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Código do Banco" required>
                  <Controller
                    name="paymentMethod.bankCode"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="001"
                        maxLength={8}
                        aria-label="Código do Banco"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item label="Agência" required>
                  <Controller
                    name="paymentMethod.branch"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="1234"
                        aria-label="Agência"
                      />
                    )}
                  />
                </Form.Item>
              </Col>

              <Col span={8}>
                <Form.Item label="Tipo de Conta" required>
                  <Controller
                    name="paymentMethod.accountType"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        placeholder="Tipo"
                        options={[
                          { label: 'Corrente', value: 'corrente' },
                          { label: 'Poupança', value: 'poupanca' },
                        ]}
                        aria-label="Tipo de Conta"
                      />
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Conta" required>
              <Controller
                name="paymentMethod.account"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="12345-6"
                    aria-label="Conta"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Nome do Titular" required>
              <Controller
                name="paymentMethod.holderName"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="Nome completo do titular"
                    aria-label="Nome do Titular"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="CNPJ do Titular" required>
              <Controller
                name="paymentMethod.holderDocument"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    onChange={(e) => {
                      const masked = maskCNPJ(e.target.value);
                      field.onChange(masked);
                    }}
                    aria-label="CNPJ do Titular"
                  />
                )}
              />
            </Form.Item>
          </>
        )}

        <Form.Item
          label="Dia do Repasse"
          validateStatus={errors.payoutDay ? 'error' : ''}
          help={errors.payoutDay?.message || 'Entre 1 e 28 (opcional)'}
        >
          <Controller
            name="payoutDay"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                min={1}
                max={28}
                placeholder="15"
                style={{ width: 100 }}
                aria-label="Dia do Repasse"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Valor Mínimo para Repasse"
          validateStatus={errors.minPayoutAmount ? 'error' : ''}
          help={errors.minPayoutAmount?.message || 'Valor mínimo em R$ (opcional)'}
        >
          <Controller
            name="minPayoutAmount"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                min={0}
                placeholder="100.00"
                style={{ width: 160 }}
                prefix="R$"
                precision={2}
                aria-label="Valor Mínimo para Repasse"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Comissão por Item Recebido"
          validateStatus={errors.commissionPerItem ? 'error' : ''}
          help={errors.commissionPerItem?.message || 'Valor pago por cada item recebido neste ponto. Deixe em branco para não aplicar comissão.'}
        >
          <Controller
            name="commissionPerItem"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                onChange={(value) => field.onChange(value === null || value === undefined ? null : value)}
                min={0}
                step={0.01}
                placeholder="0.00"
                style={{ width: 160 }}
                prefix="R$"
                precision={2}
                aria-label="Comissão por Item Recebido"
              />
            )}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
