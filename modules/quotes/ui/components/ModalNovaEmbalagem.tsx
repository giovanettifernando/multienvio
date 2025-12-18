"use client";

import { App, Form, Input, InputNumber, Space } from 'antd';
import { ELModal } from '@/shared/ui/ELModal';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { packagingCreateSchema, type PackagingCreateInput } from '@/shared/validation/packaging';
import { useCreatePackaging } from '@/hooks/usePackaging';
import { useEffect } from 'react';

interface ModalNovaEmbalagemProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (id: string) => void;
}

const unitStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  background: '#fafafa',
  border: '1px solid #d9d9d9',
  borderLeft: 0,
  borderRadius: '0 6px 6px 0',
  height: 24,
  fontSize: 12,
  color: 'rgba(0, 0, 0, 0.65)',
};

// Parser que aceita tanto vírgula quanto ponto como separador decimal
const parseDecimal = (value: string | undefined): number => {
  if (!value) return 0;
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

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
    <ELModal
      title="Nova embalagem"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit(onSubmit)}
      okText="Salvar"
      cancelText="Cancelar"
      confirmLoading={createPackaging.isPending}
      destroyOnHidden
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
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  {...field}
                  size="small"
                  style={{ width: '100%', borderRadius: '6px 0 0 6px' }}
                  placeholder="Ex: 30"
                  min={0.01}
                  step={0.01}
                  precision={2}
                  parser={parseDecimal}
                />
                <span style={unitStyle}>cm</span>
              </Space.Compact>
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
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  {...field}
                  size="small"
                  style={{ width: '100%', borderRadius: '6px 0 0 6px' }}
                  placeholder="Ex: 20"
                  min={0.01}
                  step={0.01}
                  precision={2}
                  parser={parseDecimal}
                />
                <span style={unitStyle}>cm</span>
              </Space.Compact>
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
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber
                  {...field}
                  size="small"
                  style={{ width: '100%', borderRadius: '6px 0 0 6px' }}
                  placeholder="Ex: 10"
                  min={0.01}
                  step={0.01}
                  precision={2}
                  parser={parseDecimal}
                />
                <span style={unitStyle}>cm</span>
              </Space.Compact>
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
    </ELModal>
  );
}
