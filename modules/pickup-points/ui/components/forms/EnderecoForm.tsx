'use client';

import { Form, Row, Col } from 'antd';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { maskCEP, unmaskDigits } from '@/modules/pickup-points/application/masks';
import type { PickupPointFormData } from '@/modules/pickup-points/application/types';

interface EnderecoFormProps {
  control: Control<PickupPointFormData>;
  errors: FieldErrors<PickupPointFormData>;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export default function EnderecoForm({ control, errors }: EnderecoFormProps) {
  return (
    <div style={{ padding: '16px 0' }}>
      <Form layout="vertical">
        <Form.Item
          label="CEP"
          validateStatus={errors.cep ? 'error' : ''}
          help={errors.cep?.message}
        >
          <Controller
            name="cep"
            control={control}
            render={({ field }) => (
              <ELInput
                {...field}
                value={field.value || ''}
                placeholder="00000-000"
                maxLength={9}
                style={{ width: 160 }}
                onChange={(e) => {
                  const digits = unmaskDigits(e.target.value);
                  const masked = maskCEP(digits);
                  field.onChange(masked);
                }}
                aria-label="CEP"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Logradouro"
          validateStatus={errors.logradouro ? 'error' : ''}
          help={errors.logradouro?.message}
        >
          <Controller
            name="logradouro"
            control={control}
            render={({ field }) => (
              <ELInput
                {...field}
                value={field.value || ''}
                placeholder="Rua, Avenida, etc."
                aria-label="Logradouro"
              />
            )}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="Número"
              validateStatus={errors.numero ? 'error' : ''}
              help={errors.numero?.message}
            >
              <Controller
                name="numero"
                control={control}
                render={({ field }) => (
                  <ELInput
                    {...field}
                    value={field.value || ''}
                    placeholder="Nº"
                    aria-label="Número"
                  />
                )}
              />
            </Form.Item>
          </Col>

          <Col span={16}>
            <Form.Item
              label="Complemento"
              validateStatus={errors.complemento ? 'error' : ''}
              help={errors.complemento?.message}
            >
              <Controller
                name="complemento"
                control={control}
                render={({ field }) => (
                  <ELInput
                    {...field}
                    value={field.value || ''}
                    placeholder="Sala, bloco, etc. (opcional)"
                    aria-label="Complemento"
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Bairro"
          validateStatus={errors.bairro ? 'error' : ''}
          help={errors.bairro?.message}
        >
          <Controller
            name="bairro"
            control={control}
            render={({ field }) => (
              <ELInput
                {...field}
                value={field.value || ''}
                placeholder="Bairro"
                aria-label="Bairro"
              />
            )}
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              label="Cidade"
              validateStatus={errors.cidade ? 'error' : ''}
              help={errors.cidade?.message}
            >
              <Controller
                name="cidade"
                control={control}
                render={({ field }) => (
                  <ELInput
                    {...field}
                    value={field.value || ''}
                    placeholder="Cidade"
                    aria-label="Cidade"
                  />
                )}
              />
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item
              label="UF"
              validateStatus={errors.uf ? 'error' : ''}
              help={errors.uf?.message}
            >
              <Controller
                name="uf"
                control={control}
                render={({ field }) => (
                  <ELSelect
                    {...field}
                    value={field.value || undefined}
                    placeholder="UF"
                    showSearch
                    allowClear
                    options={UFS.map((uf) => ({ label: uf, value: uf }))}
                    aria-label="UF"
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
