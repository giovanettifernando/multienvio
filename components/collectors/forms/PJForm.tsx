'use client';

import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Form, Input, Button, Row, Col, Typography, Divider, App } from 'antd';
import { BankOutlined, HomeOutlined, CopyOutlined } from '@ant-design/icons';
import type { CollectorFormInput } from '@/lib/collectors/types';
import { maskCNPJ, maskCEP, unmaskDigits } from '@/lib/collectors/masks';

const { Title, Text } = Typography;

export default function PJForm() {
  const { message } = App.useApp();
  const { control, watch, setValue, formState: { errors } } = useFormContext<CollectorFormInput>();
  const [cepLoading, setCepLoading] = useState(false);
  const [cepResolved, setCepResolved] = useState(false);

  const cep = watch('pj.endereco.cep');
  const pfEndereco = watch('pf.endereco');

  // Função para copiar endereço da PF para PJ
  const handleCopyPfAddress = () => {
    if (!pfEndereco || !pfEndereco.cep) {
      message.warning('Preencha o endereço da Pessoa Física primeiro');
      return;
    }

    setValue('pj.endereco.cep', pfEndereco.cep, { shouldValidate: false });
    setValue('pj.endereco.logradouro', pfEndereco.logradouro, { shouldValidate: false });
    setValue('pj.endereco.numero', pfEndereco.numero, { shouldValidate: false });
    setValue('pj.endereco.complemento', pfEndereco.complemento, { shouldValidate: false });
    setValue('pj.endereco.bairro', pfEndereco.bairro, { shouldValidate: false });
    setValue('pj.endereco.cidade', pfEndereco.cidade, { shouldValidate: false });
    setValue('pj.endereco.uf', pfEndereco.uf, { shouldValidate: false });
    setCepResolved(true);

    message.success('Endereço copiado da Pessoa Física');
  };

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
    <div>
      {/* Dados da Empresa */}
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BankOutlined /> Dados da Empresa
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={16}>
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
        </Col>

        <Col xs={24} md={8}>
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
                  maxLength={18}
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Endereço */}
      <Divider style={{ margin: '24px 0 16px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HomeOutlined /> Endereço da Empresa
        </Title>
        <Button
          icon={<CopyOutlined />}
          onClick={handleCopyPfAddress}
          size="small"
          type="dashed"
        >
          Copiar endereço PF
        </Button>
      </div>

      <Row gutter={[24, 0]}>
        <Col xs={24} sm={8} md={6}>
          <Form.Item
            label="CEP"
            validateStatus={errors.pj?.endereco?.cep ? 'error' : ''}
            help={errors.pj?.endereco?.cep?.message || (cepLoading ? 'Buscando...' : undefined)}
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
                  maxLength={9}
                />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={16} md={18}>
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
        </Col>
      </Row>

      <Row gutter={[24, 0]}>
        <Col xs={8} md={4}>
          <Form.Item
            label="Número"
            validateStatus={errors.pj?.endereco?.numero ? 'error' : ''}
            help={errors.pj?.endereco?.numero?.message}
          >
            <Controller
              name="pj.endereco.numero"
              control={control}
              render={({ field }) => (
                <Input {...field} value={field.value || ''} placeholder="123" />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={16} md={8}>
          <Form.Item
            label="Complemento"
            validateStatus={errors.pj?.endereco?.complemento ? 'error' : ''}
            help={errors.pj?.endereco?.complemento?.message}
          >
            <Controller
              name="pj.endereco.complemento"
              control={control}
              render={({ field }) => (
                <Input {...field} value={field.value || ''} placeholder="Sala, Andar..." />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
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
        </Col>
      </Row>

      <Row gutter={[24, 0]}>
        <Col xs={16} md={8}>
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
                />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={8} md={4}>
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
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      {cepResolved && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -16, marginBottom: 16 }}>
          Endereço preenchido automaticamente pelo CEP. Edite apenas número e complemento.
        </Text>
      )}
    </div>
  );
}
