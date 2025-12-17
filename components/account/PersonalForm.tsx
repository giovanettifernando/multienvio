"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Popconfirm,
  Space,
  Switch,
  Typography,
  Spin,
  Tooltip,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useProfile, useProfileSave } from "@/hooks/useAccount";
import type { Profile } from "@/types/account";
import { useAuthStore } from "@/stores/auth";
import { maskCPF, maskCNPJ, maskPhone, onlyDigits } from "@/lib/masks";
import { isValidCNPJ, isValidCPF } from "@/lib/validation/validators";

const formSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe o nome completo."),
    email: z.string().trim().email("E-mail inválido."),
    phone: z.string().min(1, "Informe o telefone."),
    cpf: z.string().min(1, "Informe o CPF."),
    hasCompany: z.boolean(),
    cnpj: z.string(),
    razaoSocial: z.string(),
    avatarDataUrl: z.string().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const phoneDigits = onlyDigits(value.phone);
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Telefone inválido",
        path: ["phone"],
      });
    }

    const cpfDigits = onlyDigits(value.cpf);
    if (!isValidCPF(cpfDigits)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CPF inválido",
        path: ["cpf"],
      });
    }

    if (value.hasCompany) {
      const cnpjDigits = onlyDigits(value.cnpj);
      if (cnpjDigits.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o CNPJ",
          path: ["cnpj"],
        });
      } else if (!isValidCNPJ(cnpjDigits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CNPJ inválido",
          path: ["cnpj"],
        });
      }

      if (!value.razaoSocial.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a razão social",
          path: ["razaoSocial"],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png"];

function profileToForm(profile?: Profile | null): FormValues {
  return {
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ? maskPhone(profile.phone) : "",
    cpf: profile?.cpf ? maskCPF(profile.cpf) : "",
    hasCompany: profile?.hasCompany ?? false,
    cnpj: profile?.company?.cnpj ? maskCNPJ(profile.company.cnpj) : "",
    razaoSocial: profile?.company?.razaoSocial ?? "",
    avatarDataUrl: profile?.avatarDataUrl ?? null,
  };
}

function collectErrorMessages(errors: FieldErrors<FormValues>): string[] {
  const messages = new Set<string>();

  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      const maybeMessage = (value as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage.trim()) {
        messages.add(maybeMessage.trim());
      }
      const maybeTypes = (value as { types?: unknown }).types;
      if (maybeTypes) {
        visit(maybeTypes);
      }
      Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
        if (["message", "type", "ref", "types"].includes(key)) return;
        visit(nested);
      });
    }
  };

  visit(errors);
  return Array.from(messages);
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PersonalForm() {
  const { message } = App.useApp();
  const profileQuery = useProfile();
  const saveMutation = useProfileSave();
  const updateUser = useAuthStore((state) => state.updateUser);
  const setHasCompany = useAuthStore((state) => state.setHasCompany);

  const defaultValues = useMemo(() => profileToForm(profileQuery.data), [profileQuery.data]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: defaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasCompany = useWatch({ control: form.control, name: "hasCompany" });
  const fullNameValue = useWatch({ control: form.control, name: "fullName" });

  useEffect(() => {
    if (profileQuery.data) {
      form.reset(profileToForm(profileQuery.data));
    }
  }, [profileQuery.data, form]);

  useEffect(() => {
    if (profileQuery.data) {
      updateUser({
        name: profileQuery.data.fullName,
        email: profileQuery.data.email,
        phone: profileQuery.data.phone,
        avatarUrl: profileQuery.data.avatarDataUrl,
      });
      setHasCompany(profileQuery.data.hasCompany);
    }
  }, [profileQuery.data, updateUser, setHasCompany]);

  const errorMessages = useMemo(
    () => collectErrorMessages(form.formState.errors),
    [form.formState.errors],
  );

  const handleCompanyToggle = (checked: boolean) => {
    form.setValue("hasCompany", checked, { shouldDirty: true });
    if (!checked) {
      form.setValue("cnpj", "", { shouldDirty: true });
      form.setValue("razaoSocial", "", { shouldDirty: true });
      form.clearErrors(["cnpj", "razaoSocial"]);
    }
  };

  const handleAvatarUpload = (file: File, onChange: (value: string | null) => void) => {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      message.warning("Formato não suportado. Use JPG ou PNG.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      message.warning("Tamanho máximo: 2 MB.");
      return;
    }

    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() ?? null;
      onChange(result);
      setAvatarUploading(false);
    };
    reader.onerror = () => {
      message.error("Não foi possível carregar a imagem. Tente novamente.");
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    onChange: (value: string | null) => void,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleAvatarUpload(file, onChange);
    }
    event.target.value = "";
  };

  const handleSubmit = form.handleSubmit(
    (values) => {
      setSubmitAttempted(false);
      const payload: Profile = {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: onlyDigits(values.phone),
        cpf: onlyDigits(values.cpf),
        hasCompany: values.hasCompany,
        company: values.hasCompany
          ? {
              cnpj: onlyDigits(values.cnpj),
              razaoSocial: values.razaoSocial.trim(),
            }
          : null,
        avatarDataUrl: values.avatarDataUrl ?? null,
      };

      saveMutation.mutate(payload, {
        onSuccess: (profile) => {
          form.reset(profileToForm(profile));
          updateUser({
            name: profile.fullName,
            email: profile.email,
            phone: profile.phone,
            avatarUrl: profile.avatarDataUrl,
          });
          setHasCompany(profile.hasCompany);
          message.success("Dados salvos com sucesso.");
        },
        onError: (error) => {
          message.error(
            error instanceof Error
              ? error.message
              : "Não foi possível salvar os dados.",
          );
        },
      });
    },
    () => {
      setSubmitAttempted(true);
      message.error("Revise os campos destacados.");
    },
  );

  const handleCancel = () => {
    form.reset(defaultValues);
    form.clearErrors();
    setSubmitAttempted(false);
    message.info("Alterações descartadas.");
  };

  const avatarInitials = useMemo(
    () => initialsFromName(fullNameValue || "Usuário"),
    [fullNameValue],
  );

  if (profileQuery.isLoading) {
    return <Spin size="large" style={{ display: "block", textAlign: "center", padding: 40 }} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Space orientation="vertical" size={24} style={{ width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Dados Pessoais
        </Typography.Title>

        <Controller
          name="avatarDataUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Flex
              align="center"
              justify="center"
              vertical
              gap={16}
              style={{ width: "100%", padding: "16px 0" }}
            >
                <input
                  type="file"
                  accept={ALLOWED_AVATAR_TYPES.join(",")}
                  ref={fileInputRef}
                  hidden
                  onChange={(event) => handleAvatarInputChange(event, field.onChange)}
                />
                <Flex align="center" gap={12}>
                  <Button
                    type="text"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Alterar foto do usuário"
                    style={{ padding: 0 }}
                  >
                    <span
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                        backgroundColor: "var(--color-fill-tertiary)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {field.value ? (
                        <img
                          src={field.value}
                          alt="Foto do usuário"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: "center",
                          }}
                          draggable={false}
                        />
                      ) : (
                        <Typography.Text strong style={{ fontSize: 32 }}>
                          {avatarInitials}
                        </Typography.Text>
                      )}
                    </span>
                  </Button>
                  {field.value ? (
                    <Popconfirm
                      title="Remover sua foto?"
                      okText="Remover"
                      cancelText="Cancelar"
                      onConfirm={() => field.onChange(null)}
                      placement="right"
                    >
                      <Tooltip title="Remover foto">
                        <Button
                          shape="circle"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Remover foto"
                          tabIndex={0}
                        />
                      </Tooltip>
                    </Popconfirm>
                  ) : null}
                </Flex>
                {avatarUploading ? <Spin size="small" aria-live="polite" /> : null}
                {fieldState.error ? (
                  <Typography.Text type="danger" aria-live="assertive">
                    {fieldState.error.message}
                  </Typography.Text>
                ) : null}
              </Flex>
            )}
          />

          {submitAttempted && errorMessages.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message="Revise os campos obrigatórios"
              description={
                <ul style={{ margin: "8px 0 0 16px", padding: 0 }} aria-live="assertive">
                  {errorMessages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              }
            />
          ) : null}

          <Card size="small" title="Dados pessoais" variant="outlined" style={{ borderRadius: 12 }}>
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <Controller
                name="fullName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="Nome completo"
                    required
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message}
                  >
                    <Input
                      {...field}
                      placeholder="Nome e sobrenome"
                      aria-invalid={fieldState.invalid}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="E-mail"
                    required
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message || "Email não pode ser alterado"}
                  >
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      placeholder="email@empresa.com"
                      aria-invalid={fieldState.invalid}
                      disabled
                      readOnly
                      onChange={(event) => field.onChange(event.target.value.toLowerCase())}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                name="phone"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="Telefone"
                    required
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message}
                  >
                    <Input
                      {...field}
                      inputMode="tel"
                      placeholder="(00) 00000-0000"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => field.onChange(maskPhone(event.target.value))}
                    />
                  </Form.Item>
                )}
              />
              <Controller
                name="cpf"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="CPF"
                    required
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message}
                  >
                    <Input
                      {...field}
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      aria-invalid={fieldState.invalid}
                      onChange={(event) => field.onChange(maskCPF(event.target.value))}
                    />
                  </Form.Item>
                )}
              />
            </Space>
          </Card>

          <Card
            size="small"
            variant="outlined"
            style={{ borderRadius: 12 }}
          >
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <Flex align="center" gap={8}>
                <Typography.Text>Adicionar dados de empresa</Typography.Text>
                <Switch
                  checked={hasCompany}
                  onChange={handleCompanyToggle}
                  aria-label="Adicionar dados de empresa"
                />
              </Flex>

              {hasCompany && (
                <>
                  <Controller
                    name="cnpj"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        label="CNPJ"
                        required
                        validateStatus={fieldState.error ? "error" : ""}
                        help={fieldState.error?.message}
                      >
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="00.000.000/0000-00"
                          aria-invalid={fieldState.invalid}
                          onChange={(event) => field.onChange(maskCNPJ(event.target.value))}
                        />
                      </Form.Item>
                    )}
                  />
                  <Controller
                    name="razaoSocial"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        label="Razão social"
                        required
                        validateStatus={fieldState.error ? "error" : ""}
                        help={fieldState.error?.message}
                      >
                        <Input
                          {...field}
                          placeholder="Nome empresarial"
                          aria-invalid={fieldState.invalid}
                        />
                      </Form.Item>
                    )}
                  />
                </>
              )}
            </Space>
          </Card>

          <Flex justify="flex-end" gap={12} wrap>
            <Button
              type="text"
              onClick={handleCancel}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saveMutation.isPending}
            >
              Salvar
            </Button>
          </Flex>
        </Space>
      </form>
  );
}
