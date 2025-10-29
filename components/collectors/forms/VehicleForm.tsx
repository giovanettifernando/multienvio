'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Form, Input, Select, Space } from 'antd';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { maskPlateMercosul, unmaskDigits } from '@/lib/collectors/masks';

// Marcas comuns de veículos
const VEHICLE_BRANDS = [
  'Fiat',
  'Volkswagen',
  'Ford',
  'Chevrolet',
  'Renault',
  'Peugeot',
  'Citroën',
  'Mercedes-Benz',
  'Iveco',
  'Hyundai',
  'Toyota',
  'Nissan',
  'Outro',
];

export default function VehicleForm() {
  const { control, formState: { errors } } = useFormContext<CollectorFormInput>();

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Form.Item
        label="Placa (Mercosul)"
        required
        validateStatus={errors.vehicle?.plate ? 'error' : ''}
        help={errors.vehicle?.plate?.message || 'Formato: AAA0A00'}
      >
        <Controller
          name="vehicle.plate"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              placeholder="AAA0A00"
              maxLength={7}
              onChange={(e) => field.onChange(maskPlateMercosul(e.target.value).toUpperCase())}
              style={{ width: 160 }}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Marca do veículo"
        required
        validateStatus={errors.vehicle?.brand ? 'error' : ''}
        help={errors.vehicle?.brand?.message}
      >
        <Controller
          name="vehicle.brand"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              showSearch
              placeholder="Selecione ou digite a marca"
              options={VEHICLE_BRANDS.map((brand) => ({ label: brand, value: brand }))}
              style={{ width: 250 }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Modelo"
        validateStatus={errors.vehicle?.model ? 'error' : ''}
        help={errors.vehicle?.model?.message}
      >
        <Controller
          name="vehicle.model"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              placeholder="Ex: Ducato, Sprinter, Master"
              style={{ width: 300 }}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Ano"
        validateStatus={errors.vehicle?.year ? 'error' : ''}
        help={errors.vehicle?.year?.message}
      >
        <Controller
          name="vehicle.year"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              placeholder="2024"
              maxLength={4}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                field.onChange(value || null);
              }}
              style={{ width: 120 }}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="RENAVAM"
        required
        validateStatus={errors.vehicle?.renavam ? 'error' : ''}
        help={errors.vehicle?.renavam?.message || 'Deve ter entre 9 e 11 dígitos'}
      >
        <Controller
          name="vehicle.renavam"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              placeholder="12345678901"
              maxLength={11}
              onChange={(e) => {
                const value = unmaskDigits(e.target.value);
                field.onChange(value);
              }}
              style={{ width: 200 }}
            />
          )}
        />
      </Form.Item>
    </Space>
  );
}
