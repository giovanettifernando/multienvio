'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { InputNumber, Space, Typography } from 'antd';
import { ELFormItem, ELInput, ELSegmented, ELSelect } from '@/shared/ui';
import type { CollectorFormInput } from '@/modules/collectors/application/types';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/shared/utils/format';

const { Title } = Typography;

export default function FinanceForm() {
  const { control, watch, setValue, clearErrors, formState: { errors } } = useFormContext<CollectorFormInput>();

  const commissionKind = watch('commission.kind');
  const bankKind = watch('bank.kind');

  const commissionLabel = commissionKind === 'fixa' ? 'Valor por coleta (R$)' : 'Valor por km (R$)';
  const commissionPlaceholder = commissionKind === 'fixa' ? 'R$ 7,50 por coleta' : 'R$ 1,20 por km';

  const handleCommissionKindChange = (value: 'fixa' | 'porKm') => {
    if (value === 'fixa') {
      setValue('commission', { kind: 'fixa', amount: 0 }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('commission', { kind: 'porKm', amountPerKm: 0 }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('commission');
  };

  const handleBankKindChange = (value: 'pix' | 'transfer') => {
    if (value === 'pix') {
      setValue('bank', { kind: 'pix', pixType: 'cnpj', pixKey: '' }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('bank', { kind: 'transfer', bankCode: '', branch: '', account: '', accountType: 'corrente', holderName: '', holderCnpj: '' }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('bank');
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size={24}>
      {/* Seção de Comissão */}
      <div>
        <Title level={5}>Modelo de Comissão</Title>
        <ELFormItem label="Tipo de comissão" required>
          <ELSegmented
            value={commissionKind}
            onChange={(value) => handleCommissionKindChange(value as 'fixa' | 'porKm')}
            options={[
              { label: 'Valor fixo por coleta', value: 'fixa' },
              { label: 'Valor por quilômetro', value: 'porKm' },
            ]}
          />
        </ELFormItem>

        <ELFormItem
          label={commissionLabel}
          required
          validateStatus={errors.commission ? 'error' : undefined}
          help={errors.commission?.message || 'Informe o valor recebido pelo coletor conforme o modelo selecionado.'}
        >
          {commissionKind === 'fixa' ? (
            <Controller
              name="commission.amount"
              control={control}
              render={({ field }) => (
                <InputNumber
                  {...field}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="R$"
                  decimalSeparator=","
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  placeholder={commissionPlaceholder}
                  style={{ width: 220 }}
                />
              )}
            />
          ) : (
            <Controller
              name="commission.amountPerKm"
              control={control}
              render={({ field }) => (
                <InputNumber
                  {...field}
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="R$"
                  decimalSeparator=","
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  placeholder={commissionPlaceholder}
                  style={{ width: 220 }}
                />
              )}
            />
          )}
        </ELFormItem>

        <ELFormItem label="Taxa mínima (R$)" help="Valor mínimo cobrado, independente da distância">
          <Controller
            name="pickupFee.minimum"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                onChange={(v) => field.onChange(v ?? null)}
                min={0}
                step={0.01}
                precision={2}
                prefix="R$"
                decimalSeparator=","
                formatter={inputNumberFormatterBRL}
                parser={inputNumberParserBRL}
                placeholder="Sem mínimo"
                style={{ width: 220 }}
              />
            )}
          />
        </ELFormItem>
      </div>

      {/* Seção de Pagamento */}
      <div>
        <Title level={5}>Forma de Pagamento</Title>
        <ELFormItem label="Método de pagamento" required>
          <ELSegmented
            value={bankKind}
            onChange={(value) => handleBankKindChange(value as 'pix' | 'transfer')}
            options={[
              { label: 'PIX', value: 'pix' },
              { label: 'Transferência bancária', value: 'transfer' },
            ]}
          />
        </ELFormItem>

        {bankKind === 'pix' ? (
          <>
            <ELFormItem
              label="Tipo de chave PIX"
              required
              validateStatus={errors.bank ? 'error' : undefined}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.pixType"
                control={control}
                render={({ field }) => (
                  <ELSelect
                    {...field}
                    style={{ width: 200 }}
                    options={[
                      { label: 'CPF', value: 'cpf' },
                      { label: 'CNPJ', value: 'cnpj' },
                      { label: 'E-mail', value: 'email' },
                      { label: 'Telefone', value: 'phone' },
                      { label: 'Chave aleatória', value: 'random' },
                    ]}
                  />
                )}
              />
            </ELFormItem>

            <ELFormItem
              label="Chave PIX"
              required
              validateStatus={errors.bank ? 'error' : undefined}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.pixKey"
                control={control}
                render={({ field }) => (
                  <ELInput {...field} placeholder="Informe a chave PIX" style={{ width: 300 }} />
                )}
              />
            </ELFormItem>
          </>
        ) : (
          <>
            <ELFormItem
              label="Código do banco"
              required
              validateStatus={errors.bank ? 'error' : undefined}
              help={errors.bank?.message || 'Ex: 001, 237, 104'}
            >
              <Controller
                name="bank.bankCode"
                control={control}
                render={({ field }) => (
                  <ELInput {...field} placeholder="000" maxLength={3} style={{ width: 120 }} />
                )}
              />
            </ELFormItem>

            <Space size={12}>
              <ELFormItem
                label="Agência"
                required
                validateStatus={errors.bank ? 'error' : undefined}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.branch"
                  control={control}
                  render={({ field }) => (
                    <ELInput {...field} placeholder="0000" style={{ width: 120 }} />
                  )}
                />
              </ELFormItem>

              <ELFormItem
                label="Conta"
                required
                validateStatus={errors.bank ? 'error' : undefined}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.account"
                  control={control}
                  render={({ field }) => (
                    <ELInput {...field} placeholder="12345-6" style={{ width: 150 }} />
                  )}
                />
              </ELFormItem>

              <ELFormItem
                label="Tipo"
                required
                validateStatus={errors.bank ? 'error' : undefined}
                help={errors.bank?.message}
              >
                <Controller
                  name="bank.accountType"
                  control={control}
                  render={({ field }) => (
                    <ELSelect
                      {...field}
                      style={{ width: 140 }}
                      options={[
                        { label: 'Corrente', value: 'corrente' },
                        { label: 'Poupança', value: 'poupanca' },
                      ]}
                    />
                  )}
                />
              </ELFormItem>
            </Space>

            <ELFormItem
              label="Titular (Razão Social)"
              required
              validateStatus={errors.bank ? 'error' : undefined}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.holderName"
                control={control}
                render={({ field }) => (
                  <ELInput {...field} placeholder="Razão social da empresa" />
                )}
              />
            </ELFormItem>

            <ELFormItem
              label="CNPJ do titular"
              required
              validateStatus={errors.bank ? 'error' : undefined}
              help={errors.bank?.message}
            >
              <Controller
                name="bank.holderCnpj"
                control={control}
                render={({ field }) => (
                  <ELInput {...field} placeholder="00.000.000/0000-00" style={{ width: 220 }} />
                )}
              />
            </ELFormItem>
          </>
        )}
      </div>
    </Space>
  );
}
