'use client';

import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Form, Input, DatePicker, Checkbox, Space, Typography, Select } from 'antd';
import dayjs from 'dayjs';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { maskPhone, maskCEP, maskCPF, unmaskDigits } from '@/lib/collectors/masks';

const { Text } = Typography;

export default function PFForm() {
  const { control, watch, setValue, formState: { errors } } = useFormContext<CollectorFormInput>();
  const [cepLoading, setCepLoading] = useState(false);

  const usarMesmoNumero = watch('pf.usarMesmoNumero');
  const celular = watch('pf.celular');
  const cep = watch('pf.endereco.cep');
  const [cepResolved, setCepResolved] = useState(false);

  // Sincronizar WhatsApp com Celular quando checkbox marcado
  useEffect(() => {
    if (usarMesmoNumero && celular) {
      setValue('pf.whatsapp', celular, { shouldValidate: false });
    }
  }, [usarMesmoNumero, celular, setValue]);

  // Buscar CEP quando válido
  useEffect(() => {
    const fetchCep = async () => {
      if (!cep) {
        setCepResolved(false);
        return;
      }

      const digits = unmaskDigits(cep);
      if (digits.length !== 8) {
        setCepResolved(false);
        return;
      }

      setCepLoading(true);
      try {
        const response = await fetch(`/api/cep/${digits}`);
        if (response.ok) {
          const data = await response.json();
          setValue('pf.endereco.logradouro', data.logradouro || null, { shouldValidate: false });
          setValue('pf.endereco.bairro', data.bairro || null, { shouldValidate: false });
          setValue('pf.endereco.cidade', data.cidade || null, { shouldValidate: false });
          setValue('pf.endereco.uf', data.uf || null, { shouldValidate: false });
          setCepResolved(true);
        } else {
          setCepResolved(false);
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        setCepResolved(false);
      } finally {
        setCepLoading(false);
      }
    };

    const timer = setTimeout(fetchCep, 500);
    return () => clearTimeout(timer);
  }, [cep, setValue]);

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Form.Item
        label="Nome completo"
        required
        validateStatus={errors.pf?.nome ? 'error' : ''}
        help={errors.pf?.nome?.message}
      >
        <Controller
          name="pf.nome"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="Nome completo do coletor" />
          )}
        />
      </Form.Item>

      <Form.Item
        label="CPF"
        required
        validateStatus={errors.pf?.cpf ? 'error' : ''}
        help={errors.pf?.cpf?.message}
      >
        <Controller
          name="pf.cpf"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              onChange={(e) => field.onChange(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              style={{ width: 200 }}
              maxLength={14}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="E-mail"
        required
        validateStatus={errors.pf?.email ? 'error' : ''}
        help={errors.pf?.email?.message}
      >
        <Controller
          name="pf.email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              type="email"
              placeholder="email@exemplo.com"
            />
          )}
        />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
        CNH
      </Typography.Title>

      <Form.Item
        label="Número da CNH"
        required
        validateStatus={errors.pf?.cnh?.number ? 'error' : ''}
        help={errors.pf?.cnh?.number?.message}
      >
        <Controller
          name="pf.cnh.number"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="Número da CNH" maxLength={11} />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Categoria"
        required
        validateStatus={errors.pf?.cnh?.category ? 'error' : ''}
        help={errors.pf?.cnh?.category?.message}
      >
        <Controller
          name="pf.cnh.category"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              placeholder="Selecione a categoria"
              style={{ width: 180 }}
              options={[
                { value: 'ACC', label: 'ACC' },
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' },
                { value: 'C', label: 'C' },
                { value: 'D', label: 'D' },
                { value: 'E', label: 'E' },
              ]}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Validade"
        required
        validateStatus={errors.pf?.cnh?.expiresAt ? 'error' : ''}
        help={errors.pf?.cnh?.expiresAt?.message}
      >
        <Controller
          name="pf.cnh.expiresAt"
          control={control}
          render={({ field }) => (
            <DatePicker
              {...field}
              value={field.value ? dayjs(field.value) : null}
              onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : '')}
              format="DD/MM/YYYY"
              placeholder="Selecione a validade"
              style={{ width: 200 }}
            />
          )}
        />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
        Endereço
      </Typography.Title>

      <Form.Item
        label="CEP"
        validateStatus={errors.pf?.endereco?.cep ? 'error' : ''}
        help={errors.pf?.endereco?.cep?.message || (cepLoading ? 'Buscando CEP...' : undefined)}
      >
        <Controller
          name="pf.endereco.cep"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              onChange={(e) => field.onChange(maskCEP(e.target.value))}
              placeholder="00000-000"
              style={{ width: 160 }}
              maxLength={9}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Logradouro"
        validateStatus={errors.pf?.endereco?.logradouro ? 'error' : ''}
        help={errors.pf?.endereco?.logradouro?.message}
      >
        <Controller
          name="pf.endereco.logradouro"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              disabled={cepResolved}
              placeholder="Rua, Avenida..."
            />
          )}
        />
      </Form.Item>

      <Space size={12}>
        <Form.Item
          label="Número"
          validateStatus={errors.pf?.endereco?.numero ? 'error' : ''}
          help={errors.pf?.endereco?.numero?.message}
        >
          <Controller
            name="pf.endereco.numero"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                placeholder="123"
                style={{ width: 100 }}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Complemento"
          validateStatus={errors.pf?.endereco?.complemento ? 'error' : ''}
          help={errors.pf?.endereco?.complemento?.message}
        >
          <Controller
            name="pf.endereco.complemento"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                placeholder="Apto, Bloco..."
                style={{ width: 200 }}
              />
            )}
          />
        </Form.Item>
      </Space>

      <Form.Item
        label="Bairro"
        validateStatus={errors.pf?.endereco?.bairro ? 'error' : ''}
        help={errors.pf?.endereco?.bairro?.message}
      >
        <Controller
          name="pf.endereco.bairro"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              disabled={cepResolved}
              placeholder="Bairro"
            />
          )}
        />
      </Form.Item>

      <Space size={12}>
        <Form.Item
          label="Cidade"
          validateStatus={errors.pf?.endereco?.cidade ? 'error' : ''}
          help={errors.pf?.endereco?.cidade?.message}
        >
          <Controller
            name="pf.endereco.cidade"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                disabled={cepResolved}
                placeholder="Cidade"
                style={{ width: 200 }}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="UF"
          validateStatus={errors.pf?.endereco?.uf ? 'error' : ''}
          help={errors.pf?.endereco?.uf?.message}
        >
          <Controller
            name="pf.endereco.uf"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                disabled={cepResolved}
                placeholder="SP"
                maxLength={2}
                style={{ width: 80 }}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              />
            )}
          />
        </Form.Item>
      </Space>

      {cepResolved && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Edite apenas número e complemento
        </Text>
      )}

      <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
        Contato
      </Typography.Title>

      <Form.Item
        label="Celular"
        required
        validateStatus={errors.pf?.celular ? 'error' : ''}
        help={errors.pf?.celular?.message}
      >
        <Controller
          name="pf.celular"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              onChange={(e) => field.onChange(maskPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              style={{ width: 200 }}
              maxLength={15}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        validateStatus={errors.pf?.usarMesmoNumero ? 'error' : ''}
        help={errors.pf?.usarMesmoNumero?.message}
      >
        <Controller
          name="pf.usarMesmoNumero"
          control={control}
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            >
              Usar mesmo número do celular para WhatsApp
            </Checkbox>
          )}
        />
      </Form.Item>

      <Form.Item
        label="WhatsApp"
        validateStatus={errors.pf?.whatsapp ? 'error' : ''}
        help={errors.pf?.whatsapp?.message}
      >
        <Controller
          name="pf.whatsapp"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              onChange={(e) => field.onChange(maskPhone(e.target.value))}
              placeholder="(11) 98765-4321"
              disabled={usarMesmoNumero}
              style={{ width: 200 }}
              maxLength={15}
            />
          )}
        />
      </Form.Item>
    </Space>
  );
}
