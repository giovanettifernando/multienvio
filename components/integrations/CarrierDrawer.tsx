'use client';

import { useEffect } from 'react';
import { Drawer, Form, Input, Switch, Checkbox, Button, Space, Flex } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { carrierSchema } from '@/lib/integrations/schemas';
import { useCreateCarrier, useUpdateCarrier, useCarriers } from '@/lib/integrations/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';
import type { CarrierService } from '@/lib/integrations/types';

const serviceOptions: { label: string; value: CarrierService }[] = [
  { label: 'Cotação', value: 'quote' },
  { label: 'Etiqueta', value: 'label' },
  { label: 'Rastreamento', value: 'tracking' },
];

export default function CarrierDrawer() {
  const { carrierDrawerOpen, carrierDrawerMode, editingCarrier, closeCarrierDrawer } =
    useIntegrationsStore();
  const { data: carriers } = useCarriers();
  const createCarrier = useCreateCarrier();
  const updateCarrier = useUpdateCarrier();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(carrierSchema),
    defaultValues: {
      name: '',
      slug: '',
      website: '',
      logoUrl: '',
      enabled: true,
      services: [] as const,
    },
  });

  useEffect(() => {
    if (carrierDrawerOpen && editingCarrier) {
      reset({
        name: editingCarrier.name,
        slug: editingCarrier.slug,
        website: editingCarrier.website || '',
        logoUrl: editingCarrier.logoUrl || '',
        enabled: editingCarrier.enabled,
        services: editingCarrier.services,
      });
    } else if (!carrierDrawerOpen) {
      reset({
        name: '',
        slug: '',
        website: '',
        logoUrl: '',
        enabled: true,
        services: [],
      });
    }
  }, [carrierDrawerOpen, editingCarrier, reset]);

  const onSubmit = async (data: z.infer<typeof carrierSchema>) => {
    // Check for duplicate slug
    if (carrierDrawerMode === 'create' || data.slug !== editingCarrier?.slug) {
      const isDuplicate = carriers?.some(
        (c) => c.slug === data.slug && c.id !== editingCarrier?.id
      );
      if (isDuplicate) {
        setError('slug', { message: 'Este slug já está em uso' });
        return;
      }
    }

    try {
      if (carrierDrawerMode === 'create') {
        await createCarrier.mutateAsync(data);
      } else if (editingCarrier) {
        await updateCarrier.mutateAsync({
          id: editingCarrier.id,
          data,
        });
      }
      closeCarrierDrawer();
    } catch {
      // Error already handled by hook
    }
  };

  const handleClose = () => {
    closeCarrierDrawer();
  };

  return (
    <Drawer
      title={carrierDrawerMode === 'create' ? 'Adicionar transportadora' : 'Editar transportadora'}
      open={carrierDrawerOpen}
      onClose={handleClose}
      width={560}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            type="primary"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
          >
            Salvar
          </Button>
        </Flex>
      }
    >
      <Form layout="vertical">
        <Form.Item
          label="Nome"
          required
          validateStatus={errors.name ? 'error' : ''}
          help={errors.name?.message}
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ex: Correios"
                autoFocus
                aria-label="Nome da transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Slug"
          required
          validateStatus={errors.slug ? 'error' : ''}
          help={errors.slug?.message || 'Apenas letras minúsculas, números e hífens'}
        >
          <Controller
            name="slug"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Ex: correios"
                aria-label="Slug único da transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Website"
          validateStatus={errors.website ? 'error' : ''}
          help={errors.website?.message}
        >
          <Controller
            name="website"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="https://www.exemplo.com.br"
                aria-label="Website da transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="URL do Logo"
          validateStatus={errors.logoUrl ? 'error' : ''}
          help={errors.logoUrl?.message}
        >
          <Controller
            name="logoUrl"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="https://exemplo.com/logo.png"
                aria-label="URL do logo da transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Serviços suportados"
          required
          validateStatus={errors.services ? 'error' : ''}
          help={errors.services?.message}
        >
          <Controller
            name="services"
            control={control}
            render={({ field }) => (
              <Checkbox.Group
                {...field}
                options={serviceOptions}
                aria-label="Serviços suportados pela transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item label="Status" valuePropName="checked">
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Space>
                <Switch
                  {...field}
                  checked={field.value}
                  checkedChildren="Ativa"
                  unCheckedChildren="Inativa"
                  aria-label="Status da transportadora"
                />
                <span style={{ color: '#666', fontSize: 14 }}>
                  {field.value ? 'Transportadora ativa' : 'Transportadora inativa'}
                </span>
              </Space>
            )}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
