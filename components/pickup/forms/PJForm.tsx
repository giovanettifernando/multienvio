'use client';

import { Form, Input, InputNumber } from 'antd';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { maskCNPJ, unmaskDigits } from '@/lib/pickup/masks';
import type { PickupPointFormData } from '@/lib/pickup/types';

interface PJFormProps {
  control: Control<PickupPointFormData>;
  errors: FieldErrors<PickupPointFormData>;
}

export default function PJForm({ control, errors }: PJFormProps) {
  return (
    <div style={{ padding: '16px 0' }}>
      <Form layout="vertical">
        <Form.Item
          label="Razão Social"
          required
          validateStatus={errors.razaoSocial ? 'error' : ''}
          help={errors.razaoSocial?.message}
        >
          <Controller
            name="razaoSocial"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ex: Empresa Logística Ltda"
                autoFocus
                aria-label="Razão Social"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Nome Fantasia"
          required
          validateStatus={errors.nomeFantasia ? 'error' : ''}
          help={errors.nomeFantasia?.message}
        >
          <Controller
            name="nomeFantasia"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ex: Ponto Express Centro"
                aria-label="Nome Fantasia"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="CNPJ"
          required
          validateStatus={errors.cnpj ? 'error' : ''}
          help={errors.cnpj?.message}
        >
          <Controller
            name="cnpj"
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
                aria-label="CNPJ"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Inscrição Estadual"
          validateStatus={errors.ie ? 'error' : ''}
          help={errors.ie?.message || 'Opcional'}
        >
          <Controller
            name="ie"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                placeholder="Inscrição Estadual (opcional)"
                aria-label="Inscrição Estadual"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="E-mail"
          validateStatus={errors.email ? 'error' : ''}
          help={errors.email?.message}
        >
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                type="email"
                placeholder="contato@exemplo.com.br"
                aria-label="E-mail"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Telefone"
          validateStatus={errors.telefone ? 'error' : ''}
          help={errors.telefone?.message || 'Use apenas números com DDD'}
        >
          <Controller
            name="telefone"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                placeholder="(00) 00000-0000"
                maxLength={15}
                onChange={(e) => {
                  const digits = unmaskDigits(e.target.value);
                  field.onChange(digits);
                }}
                aria-label="Telefone"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Capacidade (pedidos/dia)"
          validateStatus={errors.capacityPerDay ? 'error' : ''}
          help={errors.capacityPerDay?.message || 'Número máximo de pedidos que este ponto consegue receber por dia. Deixe 0 para ilimitado.'}
        >
          <Controller
            name="capacityPerDay"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                onChange={(value) => field.onChange(value === null || value === undefined ? null : value)}
                min={0}
                precision={0}
                placeholder="0 = sem limite"
                style={{ width: '100%' }}
                aria-label="Capacidade de pedidos por dia"
              />
            )}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
