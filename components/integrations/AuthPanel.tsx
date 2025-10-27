'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Space, Card, Empty, Flex, message as antMessage, Spin } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CopyOutlined, ReloadOutlined, SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authSchema, type AuthSchemaType } from '@/lib/integrations/schemas';
import { useCarriers, useAuth, useSaveAuth, useRotateSecret, useTestConnection } from '@/lib/integrations/hooks';
import type { AuthFieldType } from '@/lib/integrations/types';

export default function AuthPanel() {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const { data: carriers } = useCarriers();
  const { data: authConfig, isLoading: authLoading } = useAuth(selectedCarrierId);
  const saveAuth = useSaveAuth();
  const rotateSecret = useRotateSecret();
  const testConnection = useTestConnection();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AuthSchemaType>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      carrierId: '',
      fields: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control,
    name: 'fields',
  });

  useEffect(() => {
    if (authConfig && selectedCarrierId) {
      reset({
        carrierId: selectedCarrierId,
        fields: authConfig.fields,
      });
    } else if (selectedCarrierId && !authLoading) {
      // Initialize with default fields if no config exists
      reset({
        carrierId: selectedCarrierId,
        fields: [
          { key: 'apiKey', label: 'API Key', type: 'password', value: '', masked: true },
          { key: 'apiSecret', label: 'API Secret', type: 'password', value: '', masked: true },
        ],
      });
    }
  }, [authConfig, selectedCarrierId, authLoading, reset]);

  const onSubmit = async (data: AuthSchemaType) => {
    try {
      await saveAuth.mutateAsync(data);
    } catch {
      // Error handled by hook
    }
  };

  const handleToggleVisibility = (index: number) => {
    const fieldKey = fields[index].key;
    setVisibleFields((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    antMessage.success('Valor copiado');
  };

  const handleRotate = async (fieldKey: string) => {
    if (!selectedCarrierId) return;

    try {
      const result = await rotateSecret.mutateAsync({ carrierId: selectedCarrierId, fieldKey });
      // Update the form with the new value
      const updatedFields = result.fields;
      replace(updatedFields);
    } catch {
      // Error handled by hook
    }
  };

  const handleTest = async () => {
    if (!selectedCarrierId) return;
    testConnection.mutate(selectedCarrierId);
  };

  const enabledCarriers = carriers?.filter((c) => c.enabled) || [];

  if (enabledCarriers.length === 0) {
    return (
      <Empty
        description="Nenhuma transportadora ativa"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <Card>
        <Form.Item label="Transportadora" style={{ marginBottom: 0 }}>
          <Select
            placeholder="Selecione uma transportadora"
            style={{ width: 300 }}
            value={selectedCarrierId}
            onChange={setSelectedCarrierId}
            options={enabledCarriers.map((c) => ({
              label: c.name,
              value: c.id,
            }))}
          />
        </Form.Item>
      </Card>

      {selectedCarrierId && (
        <Spin spinning={authLoading}>
          <Card
            title="Credenciais de Autenticação"
            extra={
              <Space>
                <Button
                  icon={<ApiOutlined />}
                  onClick={handleTest}
                  loading={testConnection.isPending}
                >
                  Testar conexão
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                >
                  Salvar
                </Button>
              </Space>
            }
          >
            <Form layout="vertical">
              <Controller
                name="carrierId"
                control={control}
                render={({ field }) => <input type="hidden" {...field} />}
              />

              {fields.map((field, index) => {
                const fieldType = field.type as AuthFieldType;
                const isVisible = visibleFields[field.key];
                const shouldMask = fieldType === 'password' || fieldType === 'token';

                return (
                  <Form.Item
                    key={field.id}
                    label={field.label}
                    validateStatus={errors.fields?.[index]?.value ? 'error' : ''}
                    help={errors.fields?.[index]?.value?.message}
                  >
                    <Controller
                      name={`fields.${index}.key`}
                      control={control}
                      render={({ field: keyField }) => <input type="hidden" {...keyField} />}
                    />
                    <Controller
                      name={`fields.${index}.label`}
                      control={control}
                      render={({ field: labelField }) => <input type="hidden" {...labelField} />}
                    />
                    <Controller
                      name={`fields.${index}.type`}
                      control={control}
                      render={({ field: typeField }) => <input type="hidden" {...typeField} />}
                    />
                    <Controller
                      name={`fields.${index}.masked`}
                      control={control}
                      render={({ field: maskedField }) => (
                        <input type="hidden" {...maskedField} value={maskedField.value ? 'true' : 'false'} />
                      )}
                    />

                    <Controller
                      name={`fields.${index}.value`}
                      control={control}
                      render={({ field: valueField }) => (
                        <Space.Compact style={{ width: '100%' }}>
                          <Input
                            {...valueField}
                            type={shouldMask && !isVisible ? 'password' : 'text'}
                            placeholder={`Digite ${field.label}`}
                            style={{ fontFamily: shouldMask ? 'monospace' : undefined }}
                            aria-label={field.label}
                          />
                          {shouldMask && (
                            <Button
                              icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                              onClick={() => handleToggleVisibility(index)}
                              aria-label={isVisible ? 'Ocultar' : 'Mostrar'}
                            />
                          )}
                          {valueField.value && (
                            <Button
                              icon={<CopyOutlined />}
                              onClick={() => handleCopy(valueField.value || '')}
                              aria-label="Copiar"
                            />
                          )}
                          {shouldMask && (
                            <Button
                              icon={<ReloadOutlined />}
                              onClick={() => handleRotate(field.key)}
                              loading={rotateSecret.isPending}
                              aria-label="Rotacionar"
                              title="Gerar nova credencial"
                            />
                          )}
                        </Space.Compact>
                      )}
                    />
                  </Form.Item>
                );
              })}

              {fields.length === 0 && (
                <Empty description="Nenhum campo de autenticação configurado" />
              )}
            </Form>
          </Card>
        </Spin>
      )}
    </Flex>
  );
}
