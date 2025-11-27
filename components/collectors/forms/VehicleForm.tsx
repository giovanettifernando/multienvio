'use client';

import { useState, useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Form, Input, Select, Row, Col, Typography, Spin } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { useFipeBrands, useFipeModels } from '@/hooks/useFipeVehicles';

const { Title } = Typography;

// Anos disponíveis (de 2000 até ano atual + 1)
const YEARS = Array.from({ length: new Date().getFullYear() - 2000 + 2 }, (_, i) =>
  String(new Date().getFullYear() + 1 - i)
);

export default function VehicleForm() {
  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CollectorFormInput>();

  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Buscar marcas FIPE
  const { brands, loading: brandsLoading } = useFipeBrands({ vehicleType: 'cars' });

  // Buscar modelos quando marca selecionada
  const { models, loading: modelsLoading } = useFipeModels({
    brandId: selectedBrandId,
    enabled: !!selectedBrandId,
  });

  // Opções para os selects
  const brandOptions = brands.map((brand) => ({
    value: brand.id,
    label: brand.name,
    searchLabel: brand.name.toLowerCase(),
  }));

  const modelOptions = models.map((model) => ({
    value: model.id,
    label: model.name,
    searchLabel: model.name.toLowerCase(),
  }));

  const yearOptions = YEARS.map((year) => ({
    value: year,
    label: year,
  }));

  // Observar mudanças na marca selecionada
  const currentBrand = watch('vehicle.brand');

  // Quando mudar a marca, buscar a marca correspondente e atualizar modelos
  useEffect(() => {
    if (currentBrand && brands.length > 0) {
      // Tenta encontrar a marca pelo nome ou ID
      const foundBrand = brands.find(
        (b) => b.id === currentBrand || b.name === currentBrand
      );
      if (foundBrand && foundBrand.id !== selectedBrandId) {
        setSelectedBrandId(foundBrand.id);
      }
    }
  }, [currentBrand, brands, selectedBrandId]);

  // Handler para mudança de marca
  const handleBrandChange = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (brand) {
      setValue('vehicle.brand', brand.name, { shouldValidate: true });
      setValue('vehicle.model', null, { shouldValidate: false });
      setSelectedBrandId(brandId);
    }
  };

  // Handler para mudança de modelo
  const handleModelChange = (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (model) {
      setValue('vehicle.model', model.name, { shouldValidate: true });
    }
  };

  return (
    <div>
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CarOutlined /> Dados do Veículo
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} sm={12} md={8}>
          <Form.Item
            label="Placa"
            required
            validateStatus={errors.vehicle?.plate ? 'error' : ''}
            help={errors.vehicle?.plate?.message}
          >
            <Controller
              name="vehicle.plate"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="AAA0A00"
                  maxLength={8}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    field.onChange(value);
                  }}
                  style={{ textTransform: 'uppercase' }}
                />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Form.Item
            label="Ano"
            validateStatus={errors.vehicle?.year ? 'error' : ''}
            help={errors.vehicle?.year?.message}
          >
            <Controller
              name="vehicle.year"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  value={field.value || undefined}
                  placeholder="Selecione o ano"
                  options={yearOptions}
                  allowClear
                  showSearch
                  onChange={(value) => field.onChange(value || null)}
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={12}>
          <Form.Item
            label="Marca"
            required
            validateStatus={errors.vehicle?.brand ? 'error' : ''}
            help={errors.vehicle?.brand?.message}
          >
            <Controller
              name="vehicle.brand"
              control={control}
              render={({ field }) => (
                <Select
                  value={selectedBrandId || undefined}
                  placeholder="Selecione a marca"
                  loading={brandsLoading}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.searchLabel ?? '').includes(input.toLowerCase())
                  }
                  options={brandOptions}
                  onChange={handleBrandChange}
                  notFoundContent={
                    brandsLoading ? (
                      <div style={{ textAlign: 'center', padding: 12 }}>
                        <Spin size="small" />
                        <div style={{ marginTop: 4, color: '#999' }}>Carregando marcas...</div>
                      </div>
                    ) : (
                      'Nenhuma marca encontrada'
                    )
                  }
                />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="Modelo"
            validateStatus={errors.vehicle?.model ? 'error' : ''}
            help={errors.vehicle?.model?.message}
          >
            <Controller
              name="vehicle.model"
              control={control}
              render={({ field }) => (
                <Select
                  value={
                    models.find((m) => m.name === field.value)?.id || undefined
                  }
                  placeholder={
                    selectedBrandId
                      ? 'Selecione o modelo'
                      : 'Selecione uma marca primeiro'
                  }
                  disabled={!selectedBrandId}
                  loading={modelsLoading}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.searchLabel ?? '').includes(input.toLowerCase())
                  }
                  options={modelOptions}
                  onChange={handleModelChange}
                  allowClear
                  onClear={() => field.onChange(null)}
                  notFoundContent={
                    modelsLoading ? (
                      <div style={{ textAlign: 'center', padding: 12 }}>
                        <Spin size="small" />
                        <div style={{ marginTop: 4, color: '#999' }}>Carregando modelos...</div>
                      </div>
                    ) : selectedBrandId ? (
                      'Nenhum modelo encontrado'
                    ) : (
                      'Selecione uma marca primeiro'
                    )
                  }
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
}
