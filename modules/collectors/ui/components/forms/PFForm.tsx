'use client';

import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Form, DatePicker, Checkbox, Row, Col, Typography, Divider } from 'antd';
import { ELInput } from '@/shared/ui/ELInput';
import { ELSelect } from '@/shared/ui/ELSelect';
import { UserOutlined, IdcardOutlined, HomeOutlined, PhoneOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CollectorFormInput } from '@/modules/collectors/application/types';
import { maskPhone, maskCEP, maskCPF, unmaskDigits } from '@/modules/collectors/application/masks';

const { Title, Text } = Typography;

interface PFFormProps {
  showPassword?: boolean;
}

export default function PFForm({ showPassword = false }: PFFormProps) {
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
          const json = await response.json();
          // A API retorna { data: {...}, error: null, meta: {...} }
          const data = json.data || json;
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
    <div>
      {/* Dados Pessoais */}
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <UserOutlined /> Dados Pessoais
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={16}>
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
                <ELInput {...field} placeholder="Digite seu nome completo" />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={8}>
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
                <ELInput
                  {...field}
                  onChange={(e) => field.onChange(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={12}>
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
                <ELInput {...field} type="email" placeholder="seu@email.com" />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Senha (opcional para admin, obrigatório para cadastro público) */}
      {showPassword && (
        <>
          <Divider style={{ margin: '24px 0 16px' }} />
          <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockOutlined /> Senha de Acesso
          </Title>

          <Row gutter={[24, 0]}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Senha"
                required
                validateStatus={errors.pf?.password ? 'error' : ''}
                help={errors.pf?.password?.message || 'Mínimo 8 caracteres'}
              >
                <Controller
                  name="pf.password"
                  control={control}
                  render={({ field }) => (
                    <ELInput.Password
                      {...field}
                      value={field.value || ''}
                      placeholder="Crie uma senha segura"
                    />
                  )}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Confirmar senha"
                required
                validateStatus={errors.pf?.confirmPassword ? 'error' : ''}
                help={errors.pf?.confirmPassword?.message}
              >
                <Controller
                  name="pf.confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <ELInput.Password
                      {...field}
                      value={field.value || ''}
                      placeholder="Digite a senha novamente"
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {/* CNH */}
      <Divider style={{ margin: '24px 0 16px' }} />
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <IdcardOutlined /> CNH - Carteira de Habilitação
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={10}>
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
                <ELInput {...field} placeholder="00000000000" maxLength={11} />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={12} md={7}>
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
                <ELSelect
                  {...field}
                  placeholder="Categoria"
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
        </Col>

        <Col xs={12} md={7}>
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
                  placeholder="DD/MM/AAAA"
                  style={{ width: '100%' }}
                />
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Endereço */}
      <Divider style={{ margin: '24px 0 16px' }} />
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <HomeOutlined /> Endereço Residencial
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} sm={8} md={6}>
          <Form.Item
            label="CEP"
            validateStatus={errors.pf?.endereco?.cep ? 'error' : ''}
            help={errors.pf?.endereco?.cep?.message || (cepLoading ? 'Buscando...' : undefined)}
          >
            <Controller
              name="pf.endereco.cep"
              control={control}
              render={({ field }) => (
                <ELInput
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
            validateStatus={errors.pf?.endereco?.logradouro ? 'error' : ''}
            help={errors.pf?.endereco?.logradouro?.message}
          >
            <Controller
              name="pf.endereco.logradouro"
              control={control}
              render={({ field }) => (
                <ELInput
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
            validateStatus={errors.pf?.endereco?.numero ? 'error' : ''}
            help={errors.pf?.endereco?.numero?.message}
          >
            <Controller
              name="pf.endereco.numero"
              control={control}
              render={({ field }) => (
                <ELInput {...field} value={field.value || ''} placeholder="123" />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={16} md={8}>
          <Form.Item
            label="Complemento"
            validateStatus={errors.pf?.endereco?.complemento ? 'error' : ''}
            help={errors.pf?.endereco?.complemento?.message}
          >
            <Controller
              name="pf.endereco.complemento"
              control={control}
              render={({ field }) => (
                <ELInput {...field} value={field.value || ''} placeholder="Apto, Bloco..." />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={12}>
          <Form.Item
            label="Bairro"
            validateStatus={errors.pf?.endereco?.bairro ? 'error' : ''}
            help={errors.pf?.endereco?.bairro?.message}
          >
            <Controller
              name="pf.endereco.bairro"
              control={control}
              render={({ field }) => (
                <ELInput
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
            validateStatus={errors.pf?.endereco?.cidade ? 'error' : ''}
            help={errors.pf?.endereco?.cidade?.message}
          >
            <Controller
              name="pf.endereco.cidade"
              control={control}
              render={({ field }) => (
                <ELInput
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
            validateStatus={errors.pf?.endereco?.uf ? 'error' : ''}
            help={errors.pf?.endereco?.uf?.message}
          >
            <Controller
              name="pf.endereco.uf"
              control={control}
              render={({ field }) => (
                <ELInput
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

      {/* Contato */}
      <Divider style={{ margin: '24px 0 16px' }} />
      <Title level={5} style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <PhoneOutlined /> Contato
      </Title>

      <Row gutter={[24, 0]}>
        <Col xs={24} md={8}>
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
                <ELInput
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(maskPhone(e.target.value))}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                />
              )}
            />
          </Form.Item>
        </Col>

        <Col xs={24} md={16}>
          <Form.Item
            validateStatus={errors.pf?.usarMesmoNumero ? 'error' : ''}
            style={{ marginTop: 30 }}
          >
            <Controller
              name="pf.usarMesmoNumero"
              control={control}
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                >
                  Usar mesmo número para WhatsApp
                </Checkbox>
              )}
            />
          </Form.Item>
        </Col>
      </Row>

      {!usarMesmoNumero && (
        <Row gutter={[24, 0]}>
          <Col xs={24} md={8}>
            <Form.Item
              label="WhatsApp"
              validateStatus={errors.pf?.whatsapp ? 'error' : ''}
              help={errors.pf?.whatsapp?.message}
            >
              <Controller
                name="pf.whatsapp"
                control={control}
                render={({ field }) => (
                  <ELInput
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(maskPhone(e.target.value))}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                  />
                )}
              />
            </Form.Item>
          </Col>
        </Row>
      )}
    </div>
  );
}
