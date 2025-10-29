'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Segmented, Form, InputNumber } from 'antd';
import type { CollectorFormInput } from '@/lib/collectors/types';

export default function CommissionForm() {
  const { control, watch, setValue, clearErrors } = useFormContext<CollectorFormInput>();
  const kind = watch('commission.kind');
  const label =
    kind === 'porKm' ? 'Valor por km (R$)' : 'Valor por coleta (R$)';
  const placeholder =
    kind === 'porKm' ? 'R$ 1,20 por km' : 'R$ 7,50 por coleta';

  const onChangeKind = (next: 'fixa' | 'porKm') => {
    if (next === 'fixa') {
      setValue('commission', { kind: 'fixa', amount: 0 }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('commission', { kind: 'porKm', amountPerKm: 0 }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('commission');
  };

  return (
    <>
      <Form.Item label="Modelo de Comissão" required>
        <Segmented
          value={kind}
          onChange={(value) => onChangeKind(value as 'fixa' | 'porKm')}
          options={[
            { label: 'Valor fixo por coleta', value: 'fixa' },
            { label: 'Valor por quilômetro', value: 'porKm' },
          ]}
        />
      </Form.Item>
      <Form.Item label={label} required>
        {kind === 'fixa' ? (
          <Controller
            name="commission.amount"
            control={control}
            render={({ field }) => (
              <InputNumber {...field} min={0} step={0.01} prefix="R$" placeholder={placeholder} style={{ width: 220 }} />
            )}
          />
        ) : (
          <Controller
            name="commission.amountPerKm"
            control={control}
            render={({ field }) => (
              <InputNumber {...field} min={0} step={0.01} prefix="R$" placeholder={placeholder} style={{ width: 220 }} />
            )}
          />
        )}
      </Form.Item>
      <Form.Item extra="Informe o valor recebido pelo coletor conforme o modelo selecionado.">
        <span />
      </Form.Item>
    </>
  );
}
