"use client";

import { useEffect, useCallback } from "react";
import {
  ContactsOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Col,
  Form,
  Input,
  Row,
  Space,
  Typography,
  Checkbox,
} from "antd";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import {
  Controller,
  useFormContext,
} from "react-hook-form";
import { maskCPF, maskCNPJ, maskPhone } from "@/shared/utils/masks";
import { useQuoteDraft } from "@/modules/quotes/ui/state/quoteDraft";
import { useShallow } from "zustand/react/shallow";
import type { FinalizeFormValues } from '@/shared/types/quoteFinalize';

interface RecipientModalProps {
  open: boolean;
  onClose: () => void;
  /** Callback chamado quando o usuário confirma os dados */
  onConfirm?: () => void;
}

export function RecipientModal({ open, onClose, onConfirm }: RecipientModalProps) {
  const { destination, hydrated } = useQuoteDraft(
    useShallow((s) => ({ destination: s.destination, hydrated: s._hasHydrated }))
  );

  const {
    control,
    setValue,
    trigger,
    watch,
  } = useFormContext<FinalizeFormValues>();

  // Watch recipient fields para validar antes de confirmar
  const recipientNome = watch("recipient.manual.nome");
  const recipientDocumento = watch("recipient.manual.documento");
  const recipientNumero = watch("recipient.manual.numero");

  // Preencher campos bloqueados ao montar (apenas se modo manual)
  useEffect(() => {
    if (!destination || destination.mode !== "manual") return;

    setValue("recipient.manual.cep", destination.cep ?? "", { shouldDirty: false });
    setValue("recipient.manual.logradouro", destination.street ?? "", { shouldDirty: false });
    setValue("recipient.manual.bairro", destination.neighborhood ?? "", { shouldDirty: false });
    setValue("recipient.manual.cidade", destination.city ?? "", { shouldDirty: false });
    setValue("recipient.manual.uf", destination.state ?? "", { shouldDirty: false });
  }, [destination, setValue]);

  // Verificar se todos os campos obrigatórios estão preenchidos
  // Apenas Nome, CPF e Número são obrigatórios
  const isFormComplete = useCallback(() => {
    return (
      !!recipientNome && recipientNome.trim().length > 0 &&
      !!recipientDocumento && recipientDocumento.trim().length > 0 &&
      !!recipientNumero && recipientNumero.trim().length > 0
    );
  }, [recipientNome, recipientDocumento, recipientNumero]);

  const handleConfirm = async () => {
    // Validar apenas campos obrigatórios
    const isValid = await trigger([
      "recipient.manual.nome",
      "recipient.manual.documento",
      "recipient.manual.numero",
    ]);

    if (isValid && isFormComplete()) {
      onConfirm?.();
      onClose();
    }
  };

  // Aguarde hidratação antes de renderizar
  if (!hydrated) {
    return null;
  }

  // Se não está em modo manual, não exibir o modal
  if (destination?.mode !== "manual") {
    return null;
  }

  // Estilo para campos bloqueados (fonte menor)
  const disabledFieldStyle = { fontSize: 12 };

  return (
    <ELModal
      open={open}
      onCancel={onClose}
      title="Dados do Destinatário"
      size="lg"
      footer={
        <Space>
          <ELButton onClick={onClose}>
            Preencher depois
          </ELButton>
          <ELButton variant="primary" onClick={handleConfirm}>
            Confirmar
          </ELButton>
        </Space>
      }
      maskClosable={false}
    >
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        <Typography.Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
          Complete os dados do destinatário para continuar.
        </Typography.Text>

        {/* Linha 1 - Nome */}
        <Controller
          control={control}
          name="recipient.manual.nome"
          render={({ field, fieldState }) => (
            <Form.Item
              label="Nome"
              htmlFor="recipient-nome"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 8 }}
            >
              <Input {...field} id="recipient-nome" placeholder="Nome do destinatário" prefix={<UserOutlined />} />
            </Form.Item>
          )}
        />

        {/* Linha 2 - CPF/CNPJ */}
        <Controller
          control={control}
          name="recipient.manual.documento"
          render={({ field, fieldState }) => (
            <Form.Item
              label="CPF/CNPJ"
              htmlFor="recipient-documento"
              validateStatus={fieldState.error ? "error" : undefined}
              help={fieldState.error?.message}
              required
              style={{ marginBottom: 8 }}
            >
              <Input
                {...field}
                id="recipient-documento"
                placeholder="Digite o CPF ou CNPJ"
                prefix={<ContactsOutlined />}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  const formatted =
                    digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits);
                  field.onChange(formatted);
                }}
              />
            </Form.Item>
          )}
        />

        {/* Linha 3 - Telefone e E-mail (opcionais) */}
        <Row gutter={12}>
          <Col span={12}>
            <Controller
              control={control}
              name="recipient.manual.telefone"
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Telefone"
                  htmlFor="recipient-telefone"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error?.message}
                  style={{ marginBottom: 8 }}
                >
                  <Input
                    {...field}
                    id="recipient-telefone"
                    placeholder="(00) 00000-0000"
                    prefix={<PhoneOutlined />}
                    onChange={(event) =>
                      field.onChange(maskPhone(event.target.value))
                    }
                  />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={12}>
            <Controller
              control={control}
              name="recipient.manual.email"
              render={({ field, fieldState }) => (
                <Form.Item
                  label="E-mail"
                  htmlFor="recipient-email"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error?.message}
                  style={{ marginBottom: 8 }}
                >
                  <Input {...field} id="recipient-email" type="email" placeholder="email@exemplo.com" prefix={<MailOutlined />} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        {/* Linha 4 - Número e Complemento */}
        <Row gutter={12}>
          <Col span={8}>
            <Controller
              control={control}
              name="recipient.manual.numero"
              render={({ field, fieldState }) => (
                <Form.Item
                  label="Número"
                  htmlFor="recipient-numero"
                  validateStatus={fieldState.error ? "error" : undefined}
                  help={fieldState.error?.message}
                  required
                  style={{ marginBottom: 8 }}
                >
                  <Input {...field} id="recipient-numero" placeholder="Nº" />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={16}>
            <Controller
              control={control}
              name="recipient.manual.complemento"
              render={({ field }) => (
                <Form.Item label="Complemento" htmlFor="recipient-complemento" style={{ marginBottom: 8 }}>
                  <Input {...field} id="recipient-complemento" placeholder="Apartamento, bloco, etc." />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        {/* Linha 5 - Observações */}
        <Controller
          control={control}
          name="recipient.manual.observacoes"
          render={({ field }) => (
            <Form.Item label="Observações" htmlFor="recipient-observacoes" style={{ marginBottom: 8 }}>
              <Input.TextArea
                {...field}
                id="recipient-observacoes"
                placeholder="Referências de entrega, horários, etc."
                rows={2}
              />
            </Form.Item>
          )}
        />

        {/* Separador visual para campos bloqueados */}
        <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: "block" }}>
          Endereço (preenchido automaticamente)
        </Typography.Text>

        {/* Linha 6 - CEP, UF e Cidade (bloqueados) */}
        <Row gutter={12}>
          <Col span={8}>
            <Controller
              control={control}
              name="recipient.manual.cep"
              render={({ field }) => (
                <Form.Item
                  label={<span style={{ fontSize: 11 }}>CEP</span>}
                  htmlFor="recipient-cep"
                  style={{ marginBottom: 4 }}
                >
                  <Input {...field} id="recipient-cep" disabled style={disabledFieldStyle} />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={4}>
            <Controller
              control={control}
              name="recipient.manual.uf"
              render={({ field }) => (
                <Form.Item
                  label={<span style={{ fontSize: 11 }}>UF</span>}
                  htmlFor="recipient-uf"
                  style={{ marginBottom: 4 }}
                >
                  <Input {...field} id="recipient-uf" disabled maxLength={2} style={disabledFieldStyle} />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={12}>
            <Controller
              control={control}
              name="recipient.manual.cidade"
              render={({ field }) => (
                <Form.Item
                  label={<span style={{ fontSize: 11 }}>Cidade</span>}
                  htmlFor="recipient-cidade"
                  style={{ marginBottom: 4 }}
                >
                  <Input {...field} id="recipient-cidade" disabled style={disabledFieldStyle} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        {/* Linha 7 - Bairro e Logradouro (bloqueados) */}
        <Row gutter={12}>
          <Col span={10}>
            <Controller
              control={control}
              name="recipient.manual.bairro"
              render={({ field }) => (
                <Form.Item
                  label={<span style={{ fontSize: 11 }}>Bairro</span>}
                  htmlFor="recipient-bairro"
                  style={{ marginBottom: 4 }}
                >
                  <Input {...field} id="recipient-bairro" disabled style={disabledFieldStyle} />
                </Form.Item>
              )}
            />
          </Col>
          <Col span={14}>
            <Controller
              control={control}
              name="recipient.manual.logradouro"
              render={({ field }) => (
                <Form.Item
                  label={<span style={{ fontSize: 11 }}>Logradouro</span>}
                  htmlFor="recipient-logradouro"
                  style={{ marginBottom: 4 }}
                >
                  <Input {...field} id="recipient-logradouro" disabled style={disabledFieldStyle} />
                </Form.Item>
              )}
            />
          </Col>
        </Row>

        {/* Checkbox para salvar destinatário */}
        <Controller
          control={control}
          name="recipient.manual.salvarRecorrente"
          render={({ field }) => (
            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Checkbox
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              >
                Salvar destinatário recorrente
              </Checkbox>
            </Form.Item>
          )}
        />
      </Space>
    </ELModal>
  );
}
