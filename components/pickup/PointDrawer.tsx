'use client';

import { Tabs, Button, Space, Spin } from 'antd';
import { ELDrawer } from '@/components/ui/ELDrawer';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import PJForm from './forms/PJForm';
import EnderecoForm from './forms/EnderecoForm';
import PagamentoForm from './forms/PagamentoForm';
import { pickupPointSchema } from '@/lib/pickup/schemas';
import type { PickupPointFormData, PickupPoint } from '@/lib/pickup/types';
import { unmaskDigits } from '@/lib/pickup/masks';

interface PointDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PickupPointFormData) => void;
  loading?: boolean;
  editPoint?: PickupPoint | null;
}

export default function PointDrawer({
  open,
  onClose,
  onSubmit,
  loading = false,
  editPoint = null,
}: PointDrawerProps) {
  const isEditMode = !!editPoint;

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PickupPointFormData>({
    resolver: zodResolver(pickupPointSchema),
    defaultValues: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      ie: '',
      email: '',
      telefone: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: undefined,
      geo: null,
      paymentMethod: {
        kind: 'pix',
        pixType: 'email',
        pixKey: '',
      },
      payoutDay: undefined,
      minPayoutAmount: undefined,
      commissionPerItem: null,
      capacityPerDay: null,
    },
  });

  // Reset form when drawer opens/closes or editPoint changes
  useEffect(() => {
    if (open) {
      if (editPoint) {
        reset({
          razaoSocial: editPoint.razaoSocial,
          nomeFantasia: editPoint.nomeFantasia,
          cnpj: editPoint.cnpj,
          ie: editPoint.ie || '',
          email: editPoint.email || '',
          telefone: editPoint.telefone || '',
          cep: editPoint.cep || '',
          logradouro: editPoint.logradouro || '',
          numero: editPoint.numero || '',
          complemento: editPoint.complemento || '',
          bairro: editPoint.bairro || '',
          cidade: editPoint.cidade || '',
          uf: editPoint.uf || '',
          geo: editPoint.geo || null,
          paymentMethod: editPoint.paymentMethod,
          payoutDay: editPoint.payoutDay || undefined,
          minPayoutAmount: editPoint.minPayoutAmount || undefined,
          commissionPerItem: editPoint.commissionPerItem ?? null,
          capacityPerDay: editPoint.capacityPerDay ?? null,
        });
      } else {
        reset({
          razaoSocial: '',
          nomeFantasia: '',
          cnpj: '',
          ie: '',
          email: '',
          telefone: '',
          cep: '',
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: '',
          uf: undefined,
          geo: null,
          paymentMethod: {
            kind: 'pix',
            pixType: 'email',
            pixKey: '',
          },
          payoutDay: undefined,
          minPayoutAmount: undefined,
          commissionPerItem: null,
          capacityPerDay: null,
        });
      }
    }
  }, [open, editPoint, reset]);

  const handleFormSubmit = (data: PickupPointFormData) => {
    // Unmask CNPJ before submission
    const processedData = {
      ...data,
      cnpj: unmaskDigits(data.cnpj),
      cep: data.cep ? unmaskDigits(data.cep) : undefined,
      telefone: data.telefone ? unmaskDigits(data.telefone) : undefined,
    };

    // Unmask payment method fields if needed
    if (processedData.paymentMethod.kind === 'pix') {
      if (processedData.paymentMethod.pixType === 'cpf' || processedData.paymentMethod.pixType === 'cnpj') {
        processedData.paymentMethod.pixKey = unmaskDigits(processedData.paymentMethod.pixKey);
      }
    } else if (processedData.paymentMethod.kind === 'transfer') {
      processedData.paymentMethod.holderDocument = unmaskDigits(processedData.paymentMethod.holderDocument);
    }

    onSubmit(processedData);
  };

  const tabItems = [
    {
      key: 'empresa',
      label: 'Empresa',
      children: <PJForm control={control} errors={errors} />,
    },
    {
      key: 'endereco',
      label: 'Endereço',
      children: <EnderecoForm control={control} errors={errors} />,
    },
    {
      key: 'pagamento',
      label: 'Pagamento',
      children: <PagamentoForm control={control} errors={errors} watch={watch} />,
    },
  ];

  return (
    <ELDrawer
      title={isEditMode ? 'Editar Ponto de Coleta' : 'Novo Ponto de Coleta'}
      placement="right"
      drawerSize="xl"
      onClose={onClose}
      open={open}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit(handleFormSubmit)}
            loading={loading}
          >
            {isEditMode ? 'Salvar' : 'Criar'}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Tabs items={tabItems} />
      </Spin>
    </ELDrawer>
  );
}
