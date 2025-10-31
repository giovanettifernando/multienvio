"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Typography,
} from "antd";
import { PasswordStrength } from "@/components/form/PasswordStrength";
import { FormCard } from "@/components/ui/FormCard";
import { cadastroSchema } from "@/lib/validation/auth";
import {
  normalizePhoneInput,
} from "@/lib/masks";
import { useAuthStore } from "@/stores/auth";

type CadastroFormValues = z.infer<typeof cadastroSchema>;

export default function CadastroPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const registerStore = useAuthStore((state) => state.register);
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    watch,
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

  const senhaAtual = watch("senha") ?? "";

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
        const params = new URLSearchParams({
          email: result.email || values.email,
          emailSent: result.emailVerificationSent ? 'true' : 'false',
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
            <Form.Item
              label="Nome completo"
              required
              validateStatus={errors.nomeCompleto ? "error" : ""}
              help={errors.nomeCompleto?.message}
            >
              <Input
                {...field}
                autoComplete="name"
                placeholder="Informe seu nome completo"
                aria-invalid={Boolean(errors.nomeCompleto)}
              />
            </Form.Item>
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Form.Item
              label="E-mail"
              required
              validateStatus={errors.email ? "error" : ""}
              help={
                errors.email?.message ? (
                  <span id="erro-email" aria-live="assertive">
                    {errors.email.message}
                  </span>
                ) : null
              }
            >
              <Input
                {...field}
                autoComplete="email"
                inputMode="email"
                placeholder="contato@empresa.com.br"
                aria-invalid={Boolean(errors.email)}
              />
            </Form.Item>
          )}
        />

        <Controller
          name="senha"
          control={control}
          render={({ field }) => (
            <Form.Item
              label="Senha"
              required
              validateStatus={errors.senha ? "error" : ""}
              help={errors.senha?.message}
            >
              <Input.Password
                {...field}
                autoComplete="new-password"
                placeholder="Crie uma senha forte"
                aria-invalid={Boolean(errors.senha)}
              />
            </Form.Item>
          )}
        />

        <PasswordStrength value={senhaAtual} />

        <Controller
          name="confirmarSenha"
          control={control}
          render={({ field }) => (
            <Form.Item
              label="Confirmar senha"
              required
              validateStatus={errors.confirmarSenha ? "error" : ""}
              help={errors.confirmarSenha?.message}
            >
              <Input.Password
                {...field}
                autoComplete="new-password"
                placeholder="Repita a senha"
                aria-invalid={Boolean(errors.confirmarSenha)}
              />
            </Form.Item>
          )}
        />

        <Controller
          name="telefone"
          control={control}
          render={({ field }) => (
            <Form.Item
              label="Telefone (opcional)"
              validateStatus={errors.telefone ? "error" : ""}
              help={errors.telefone?.message}
            >
              <Input
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
            </Form.Item>
          )}
        />

        <Controller
          name="consentLGPD"
          control={control}
          render={({ field }) => (
            <Form.Item
              required
              validateStatus={errors.consentLGPD ? "error" : ""}
              help={errors.consentLGPD?.message}
              valuePropName="checked"
            >
              <Checkbox
                {...field}
                checked={field.value}
                aria-invalid={Boolean(errors.consentLGPD)}
              >
                Li e concordo com a{" "}
                <Link href="/termos-de-uso">Política de Privacidade</Link>{" "}
                e os <Link href="/termos-de-uso">Termos de Uso</Link>.
              </Checkbox>
            </Form.Item>
          )}
        />

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={isLoading}
            block
          >
            Criar conta
          </Button>
        </Form.Item>
      </Form>
    </FormCard>
  );
}
