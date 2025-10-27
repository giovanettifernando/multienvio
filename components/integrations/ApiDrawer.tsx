'use client';

import { useEffect } from 'react';
import { Drawer, Form, Input, Select, Switch, Button, Space, Flex } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiSchema } from '@/lib/integrations/schemas';
import { useCreateApi, useUpdateApi, useCarriers } from '@/lib/integrations/hooks';
import { useIntegrationsStore } from '@/store/integrations.store';

const { TextArea } = Input;

export default function ApiDrawer() {
  const { apiDrawerOpen, apiDrawerMode, editingApi, selectedCarrierId, closeApiDrawer } =
    useIntegrationsStore();
  const { data: carriers } = useCarriers();
  const createApi = useCreateApi();
  const updateApi = useUpdateApi();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      carrierId: '',
      environment: 'sandbox' as const,
      quoteUrl: '',
      labelUrl: '',
      trackingUrl: '',
      active: true,
      notes: '',
    },
  });

  useEffect(() => {
    if (apiDrawerOpen && editingApi) {
      reset({
        carrierId: editingApi.carrierId,
        environment: editingApi.environment,
        quoteUrl: editingApi.quoteUrl || '',
        labelUrl: editingApi.labelUrl || '',
        trackingUrl: editingApi.trackingUrl || '',
        active: editingApi.active,
        notes: editingApi.notes || '',
      });
    } else if (apiDrawerOpen && selectedCarrierId) {
      reset({
        carrierId: selectedCarrierId,
        environment: 'sandbox',
        quoteUrl: '',
        labelUrl: '',
        trackingUrl: '',
        active: true,
        notes: '',
      });
    } else if (!apiDrawerOpen) {
      reset({
        carrierId: '',
        environment: 'sandbox',
        quoteUrl: '',
        labelUrl: '',
        trackingUrl: '',
        active: true,
        notes: '',
      });
    }
  }, [apiDrawerOpen, editingApi, selectedCarrierId, reset]);

  const onSubmit = async (data: z.infer<typeof apiSchema>) => {
    try {
      if (apiDrawerMode === 'create') {
        await createApi.mutateAsync(data);
      } else if (editingApi) {
        await updateApi.mutateAsync({
          id: editingApi.id,
          data,
        });
      }
      closeApiDrawer();
    } catch {
      // Error already handled by hook
    }
  };

  const handleClose = () => {
    closeApiDrawer();
  };

  const enabledCarriers = carriers?.filter((c) => c.enabled) || [];

  return (
    <Drawer
      title={apiDrawerMode === 'create' ? 'Adicionar API' : 'Editar API'}
      open={apiDrawerOpen}
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
          label="Transportadora"
          required
          validateStatus={errors.carrierId ? 'error' : ''}
          help={errors.carrierId?.message}
        >
          <Controller
            name="carrierId"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                placeholder="Selecione uma transportadora"
                disabled={apiDrawerMode === 'edit'}
                options={enabledCarriers.map((c) => ({
                  label: c.name,
                  value: c.id,
                }))}
                aria-label="Transportadora"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Ambiente"
          required
          validateStatus={errors.environment ? 'error' : ''}
          help={errors.environment?.message}
        >
          <Controller
            name="environment"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                placeholder="Selecione o ambiente"
                options={[
                  { label: 'Sandbox', value: 'sandbox' },
                  { label: 'Produção', value: 'production' },
                ]}
                aria-label="Ambiente"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Quote URL"
          validateStatus={errors.quoteUrl ? 'error' : ''}
          help={errors.quoteUrl?.message}
        >
          <Controller
            name="quoteUrl"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="https://api.transportadora.com/v1/quote"
                aria-label="URL para cotação"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Label URL"
          validateStatus={errors.labelUrl ? 'error' : ''}
          help={errors.labelUrl?.message}
        >
          <Controller
            name="labelUrl"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="https://api.transportadora.com/v1/label"
                aria-label="URL para geração de etiqueta"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Tracking URL"
          validateStatus={errors.trackingUrl ? 'error' : ''}
          help={errors.trackingUrl?.message}
        >
          <Controller
            name="trackingUrl"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="https://api.transportadora.com/v1/tracking"
                aria-label="URL para rastreamento"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Notas"
          validateStatus={errors.notes ? 'error' : ''}
          help={errors.notes?.message}
        >
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                rows={4}
                placeholder="Notas adicionais sobre esta configuração"
                maxLength={500}
                showCount
                aria-label="Notas"
              />
            )}
          />
        </Form.Item>

        <Form.Item label="Status" valuePropName="checked">
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <Space>
                <Switch
                  {...field}
                  checked={field.value}
                  checkedChildren="Ativo"
                  unCheckedChildren="Inativo"
                  aria-label="Status da API"
                />
                <span style={{ color: '#666', fontSize: 14 }}>
                  {field.value ? 'API ativa' : 'API inativa'}
                </span>
              </Space>
            )}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
