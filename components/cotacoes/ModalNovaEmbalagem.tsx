"use client";

import { App, Form, Input, InputNumber, Modal } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { packagingCreateSchema, type PackagingCreateInput } from '@/lib/validation/packaging';
import { useCreatePackaging } from '@/hooks/usePackaging';
import { useEffect } from 'react';

interface ModalNovaEmbalagemProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (id: string) => void;
}

export function ModalNovaEmbalagem({ open, onClose, onSuccess }: ModalNovaEmbalagemProps) {
  const { message } = App.useApp();
  const createPackaging = useCreatePackaging();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PackagingCreateInput>({
    resolver: zodResolver(packagingCreateSchema),
    defaultValues: {
      name: '',
      lengthCm: undefined,
      widthCm: undefined,
      heightCm: undefined,
    },
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (data: PackagingCreateInput) => {
    try {
      const result = await createPackaging.mutateAsync(data);
      message.success('Embalagem criada com sucesso');
      onSuccess?.(result.id);
      onClose();
    } catch (error) {
      console.error('Erro ao criar embalagem:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao criar embalagem');
    }
  };

  return (
    <Modal
      title="Nova embalagem"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      okText="Salvar"
      cancelText="Cancelar"
      confirmLoading={createPackaging.isPending}
      destroyOnClose
    >
      <Form layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          label="Comprimento (C)"
          validateStatus={errors.lengthCm ? 'error' : ''}
          help={errors.lengthCm?.message}
          required
        >
          <Controller
            name="lengthCm"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                size="small"
                style={{ width: '100%' }}
                placeholder="Ex: 30"
                min={0.01}
                step={0.01}
                precision={2}
                addonAfter="cm"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Largura (L)"
          validateStatus={errors.widthCm ? 'error' : ''}
          help={errors.widthCm?.message}
          required
        >
          <Controller
            name="widthCm"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                size="small"
                style={{ width: '100%' }}
                placeholder="Ex: 20"
                min={0.01}
                step={0.01}
                precision={2}
                addonAfter="cm"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Altura (A)"
          validateStatus={errors.heightCm ? 'error' : ''}
          help={errors.heightCm?.message}
          required
        >
          <Controller
            name="heightCm"
            control={control}
            render={({ field }) => (
              <InputNumber
                {...field}
                size="small"
                style={{ width: '100%' }}
                placeholder="Ex: 10"
                min={0.01}
                step={0.01}
                precision={2}
                addonAfter="cm"
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Nome amigável (opcional)"
          validateStatus={errors.name ? 'error' : ''}
          help={errors.name?.message || 'Se vazio, será gerado automaticamente como "C (xx) x L (xx) x A (xx)"'}
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input {...field} size="small" placeholder="Ex: Caixa pequena" maxLength={100} />
            )}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
