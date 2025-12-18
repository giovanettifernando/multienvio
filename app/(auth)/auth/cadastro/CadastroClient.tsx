"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { App, Button, Divider, Form, Typography } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { PasswordStrength } from '@/shared/ui/form/PasswordStrength';
import { FormCard, ELButton, ELCheckbox, ELFormItem, ELInput } from '@/shared/ui';
import { cadastroSchema } from '@/shared/validation/auth';
import {
  normalizePhoneInput,
} from "@/shared/utils/masks";
import { useAuthStore } from '@/modules/auth/ui/state/auth';

type CadastroFormValues = z.infer<typeof cadastroSchema>;

export default function CadastroClient() {
  const router = useRouter();
  const { message } = App.useApp();
  const registerStore = useAuthStore((state) => state.register);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Handle Google signup
  const handleGoogleSignup = useCallback(() => {
    setIsGoogleLoading(true);
    // Redirect to Google OAuth with user context
    window.location.href = '/api/auth/google?context=user';
  }, []);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CadastroFormValues>({
    resolver: zodResolver(cadastroSchema) as Resolver<CadastroFormValues>,
    defaultValues: {
      nomeCompleto: "",
      email: "",
      senha: "",
      confirmarSenha: "",
      consentLGPD: false,
    },
  });

  const senhaAtual = useWatch({ control, name: "senha" }) ?? "";

  const onSubmit = useCallback(
    async (values: CadastroFormValues) => {
      setIsLoading(true);

      try {
        console.log('[CADASTRO] Form values:', {
          name: values.nomeCompleto,
          email: values.email,
          phone: values.telefone,
          consentLGPD: values.consentLGPD,
        });

        // Call store's register method with proper field mapping
        const result = await registerStore({
          name: values.nomeCompleto,
          email: values.email,
          password: values.senha,
          phone: values.telefone || undefined,
          aceiteTermos: values.consentLGPD, // Enviar aceite de termos
        });

        if (!result.success) {
          // Handle specific error cases
          if (result.error?.includes("já cadastrado")) {
            setError("email", {
              type: "manual",
              message: "Este e-mail já está cadastrado. Faça login para continuar.",
            });
          } else {
            message.error(result.error || "Não foi possível concluir seu cadastro.");
          }
          setIsLoading(false);
          return;
        }

        // Success - redirect to confirmation page (NOT auto-logged in)
        message.success("Conta criada com sucesso!");

        // Redirect to confirmation page with email and verification status
        const hasEmail = typeof result === "object" && result !== null && "email" in result && typeof result.email === "string";
        const hasEmailVerificationSent =
          typeof result === "object" && result !== null && "emailVerificationSent" in result;

        const params = new URLSearchParams({
          email: hasEmail ? (result as { email: string }).email : values.email,
          emailSent:
            hasEmailVerificationSent && (result as { emailVerificationSent?: boolean }).emailVerificationSent
              ? "true"
              : "false",
        });
        router.push(`/auth/confirmacao?${params.toString()}`);
      } catch (error) {
        console.error("Register error:", error);
        message.error("Não foi possível concluir seu cadastro. Tente novamente.");
        setIsLoading(false);
      }
    },
    [registerStore, router, message, setError],
  );

  const campoEmailErro = errors.email?.message;

  return (
    <FormCard
      titulo="Criar conta"
      subtitulo="Comece a enviar com segurança e acompanhar tudo em tempo real."
      footer={
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          Já tem uma conta?{" "}
          <Link href="/auth/login">Acesse sua conta</Link>
        </Typography.Paragraph>
      }
    >
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit(onSubmit)}
        aria-describedby={
          campoEmailErro ? "erro-email" : undefined
        }
      >
        <Controller
          name="nomeCompleto"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="Nome completo"
              required
              validateStatus={errors.nomeCompleto ? "error" : undefined}
              help={errors.nomeCompleto?.message}
            >
              <ELInput
                {...field}
                autoComplete="name"
                placeholder="Informe seu nome completo"
                aria-invalid={Boolean(errors.nomeCompleto)}
              />
            </ELFormItem>
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="E-mail"
              required
              validateStatus={errors.email ? "error" : undefined}
              help={
                errors.email?.message ? (
                  <span id="erro-email" aria-live="assertive">
                    {errors.email.message}
                  </span>
                ) : null
              }
            >
              <ELInput
                {...field}
                autoComplete="email"
                inputMode="email"
                placeholder="contato@empresa.com.br"
                aria-invalid={Boolean(errors.email)}
              />
            </ELFormItem>
          )}
        />

        <Controller
          name="senha"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="Senha"
              required
              validateStatus={errors.senha ? "error" : undefined}
              help={errors.senha?.message}
            >
              <ELInput.Password
                {...field}
                autoComplete="new-password"
                placeholder="Crie uma senha forte"
                aria-invalid={Boolean(errors.senha)}
              />
            </ELFormItem>
          )}
        />

        <PasswordStrength value={senhaAtual} />

        <Controller
          name="confirmarSenha"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="Confirmar senha"
              required
              validateStatus={errors.confirmarSenha ? "error" : undefined}
              help={errors.confirmarSenha?.message}
            >
              <ELInput.Password
                {...field}
                autoComplete="new-password"
                placeholder="Repita a senha"
                aria-invalid={Boolean(errors.confirmarSenha)}
              />
            </ELFormItem>
          )}
        />

        <Controller
          name="telefone"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="Telefone (opcional)"
              validateStatus={errors.telefone ? "error" : undefined}
              help={errors.telefone?.message}
            >
              <ELInput
                {...field}
                value={field.value ?? ""}
                onChange={(event) => {
                  const formatted = normalizePhoneInput(
                    event.target.value,
                  );
                  field.onChange(formatted);
                }}
                autoComplete="tel"
                placeholder="(11) 91234-5678"
                aria-invalid={Boolean(errors.telefone)}
                maxLength={16}
              />
            </ELFormItem>
          )}
        />

        <Controller
          name="consentLGPD"
          control={control}
          render={({ field }) => (
            <ELFormItem
              required
              validateStatus={errors.consentLGPD ? "error" : undefined}
              help={errors.consentLGPD?.message}
              valuePropName="checked"
            >
              <ELCheckbox
                {...field}
                checked={field.value}
                aria-invalid={Boolean(errors.consentLGPD)}
              >
                Li e concordo com a{" "}
                <Link href="/termos-de-uso">Política de Privacidade</Link>{" "}
                e os <Link href="/termos-de-uso">Termos de Uso</Link>.
              </ELCheckbox>
            </ELFormItem>
          )}
        />

        <Form.Item style={{ marginBottom: 0 }}>
          <ELButton
            variant="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={isLoading || isGoogleLoading}
            block
          >
            Criar conta
          </ELButton>
        </Form.Item>

        <Divider plain style={{ margin: '16px 0', color: 'rgba(0,0,0,0.45)' }}>ou</Divider>

        <Button
          block
          size="large"
          icon={<GoogleOutlined />}
          onClick={handleGoogleSignup}
          loading={isGoogleLoading}
          disabled={isLoading || isGoogleLoading}
        >
          Cadastrar com Google
        </Button>
      </Form>
    </FormCard>
  );
}
