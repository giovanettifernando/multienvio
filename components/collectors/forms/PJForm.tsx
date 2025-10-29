'use client';

import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Form, Input, Space, Typography } from 'antd';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { maskCNPJ, maskPhone, maskCEP, unmaskDigits } from '@/lib/collectors/masks';

const { Text } = Typography;

export default function PJForm() {
  const { control, watch, setValue, formState: { errors } } = useFormContext<CollectorFormInput>();
  const [cepLoading, setCepLoading] = useState(false);

  const cep = watch('pj.endereco.cep');
  const [cepResolved, setCepResolved] = useState(false);

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
          setValue('pj.endereco.logradouro', data.logradouro || null, { shouldValidate: false });
          setValue('pj.endereco.bairro', data.bairro || null, { shouldValidate: false });
          setValue('pj.endereco.cidade', data.cidade || null, { shouldValidate: false });
          setValue('pj.endereco.uf', data.uf || null, { shouldValidate: false });
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
        label="Razão Social"
        required
        validateStatus={errors.pj?.razaoSocial ? 'error' : ''}
        help={errors.pj?.razaoSocial?.message}
      >
        <Controller
          name="pj.razaoSocial"
          control={control}
          render={({ field }) => (
            <Input {...field} placeholder="Razão social da empresa" />
          )}
        />
      </Form.Item>

      <Form.Item
        label="CNPJ"
        required
        validateStatus={errors.pj?.cnpj ? 'error' : ''}
        help={errors.pj?.cnpj?.message}
      >
        <Controller
          name="pj.cnpj"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              onChange={(e) => field.onChange(maskCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              style={{ width: 220 }}
              maxLength={18}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="E-mail"
        validateStatus={errors.pj?.email ? 'error' : ''}
        help={errors.pj?.email?.message}
      >
        <Controller
          name="pj.email"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              type="email"
              placeholder="empresa@exemplo.com"
              style={{ width: 300 }}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="Telefone"
        validateStatus={errors.pj?.telefone ? 'error' : ''}
        help={errors.pj?.telefone?.message}
      >
        <Controller
          name="pj.telefone"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value || ''}
              onChange={(e) => field.onChange(maskPhone(e.target.value))}
              placeholder="(11) 3456-7890"
              style={{ width: 200 }}
              maxLength={15}
            />
          )}
        />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
        Endereço
      </Typography.Title>

      <Form.Item
        label="CEP"
        validateStatus={errors.pj?.endereco?.cep ? 'error' : ''}
        help={errors.pj?.endereco?.cep?.message || (cepLoading ? 'Buscando CEP...' : undefined)}
      >
        <Controller
          name="pj.endereco.cep"
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
        validateStatus={errors.pj?.endereco?.logradouro ? 'error' : ''}
        help={errors.pj?.endereco?.logradouro?.message}
      >
        <Controller
          name="pj.endereco.logradouro"
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
          validateStatus={errors.pj?.endereco?.numero ? 'error' : ''}
          help={errors.pj?.endereco?.numero?.message}
        >
          <Controller
            name="pj.endereco.numero"
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
          validateStatus={errors.pj?.endereco?.complemento ? 'error' : ''}
          help={errors.pj?.endereco?.complemento?.message}
        >
          <Controller
            name="pj.endereco.complemento"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value || ''}
                placeholder="Sala, Andar..."
                style={{ width: 200 }}
              />
            )}
          />
        </Form.Item>
      </Space>

      <Form.Item
        label="Bairro"
        validateStatus={errors.pj?.endereco?.bairro ? 'error' : ''}
        help={errors.pj?.endereco?.bairro?.message}
      >
        <Controller
          name="pj.endereco.bairro"
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
          validateStatus={errors.pj?.endereco?.cidade ? 'error' : ''}
          help={errors.pj?.endereco?.cidade?.message}
        >
          <Controller
            name="pj.endereco.cidade"
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
          validateStatus={errors.pj?.endereco?.uf ? 'error' : ''}
          help={errors.pj?.endereco?.uf?.message}
        >
          <Controller
            name="pj.endereco.uf"
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
    </Space>
  );
}
