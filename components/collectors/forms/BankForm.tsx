'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Segmented, Form, Select, Input } from 'antd';
import type { CollectorFormInput } from '@/lib/collectors/types';

export default function BankForm() {
  const { control, watch, setValue, clearErrors } = useFormContext<CollectorFormInput>();
  const kind = watch('bank.kind');
  const blockLabel = kind === 'pix' ? 'Pagamento via PIX' : 'Pagamento via Transferência';

  const onChangeKind = (next: 'pix' | 'transfer') => {
    if (next === 'pix') {
      setValue('bank', { kind: 'pix', pixType: 'cnpj', pixKey: '' }, { shouldDirty: true, shouldValidate: false });
    } else {
      setValue('bank', { kind: 'transfer', bankCode: '', branch: '', account: '', accountType: 'corrente', holderName: '', holderCnpj: '' }, { shouldDirty: true, shouldValidate: false });
    }
    clearErrors('bank');
  };

  return (
    <>
      <Form.Item label="Forma de Pagamento" required>
        <Segmented
          value={kind}
          onChange={(value) => onChangeKind(value as 'pix' | 'transfer')}
          options={[
            { label: 'PIX', value: 'pix' },
            { label: 'Transferência', value: 'transfer' },
          ]}
        />
      </Form.Item>
      <Form.Item label={blockLabel} colon={false} />
      {kind === 'pix' ? (
        <>
          <Form.Item label="Tipo de chave" required>
            <Controller
              name="bank.pixType"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={[
                    { value: 'cpf', label: 'CPF' },
                    { value: 'cnpj', label: 'CNPJ' },
                    { value: 'email', label: 'E-mail' },
                    { value: 'phone', label: 'Telefone' },
                    { value: 'random', label: 'Chave aleatória' },
                  ]}
                />
              )}
            />
          </Form.Item>
          <Form.Item label="Chave PIX" required>
            <Controller name="bank.pixKey" control={control} render={({ field }) => <Input {...field} placeholder="Informe a chave PIX" />} />
          </Form.Item>
        </>
      ) : (
        <>
          <Form.Item label="Banco (cód. 3 dígitos)" required>
            <Controller name="bank.bankCode" control={control} render={({ field }) => <Input {...field} placeholder="341" />} />
          </Form.Item>
          <Form.Item label="Agência" required>
            <Controller name="bank.branch" control={control} render={({ field }) => <Input {...field} placeholder="0001" />} />
          </Form.Item>
          <Form.Item label="Conta" required>
            <Controller name="bank.account" control={control} render={({ field }) => <Input {...field} placeholder="123456-7" />} />
          </Form.Item>
          <Form.Item label="Tipo de conta" required>
            <Controller
              name="bank.accountType"
              control={control}
              render={({ field }) => <Select {...field} options={[{ value: 'corrente', label: 'Corrente' }, { value: 'poupanca', label: 'Poupança' }]} />}
            />
          </Form.Item>
          <Form.Item label="Titular (razão social)" required>
            <Controller name="bank.holderName" control={control} render={({ field }) => <Input {...field} />} />
          </Form.Item>
          <Form.Item label="CNPJ do titular" required>
            <Controller name="bank.holderCnpj" control={control} render={({ field }) => <Input {...field} placeholder="___.___.___/____-__" />} />
          </Form.Item>
        </>
      )}
    </>
  );
}
