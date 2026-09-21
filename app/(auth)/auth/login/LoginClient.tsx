"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleOutlined } from "@ant-design/icons";
import { ELAlert, ELButton, ELCard, ELCheckbox, ELFormItem, ELInput, ELForm, ELTypography, useELApp } from '@/shared/ui';
const { Form, Typography } = { Form: ELForm, Typography: ELTypography };
import { spacing } from "@/shared/ui/theme";
import {
  loginSchema,
  type LoginInput,
} from '@/shared/validation/auth';
import { useAuthStore } from '@/modules/auth/ui/state/auth';
import styles from "./login.module.css";

const STORAGE_KEY = "enviolegal:last-email";

export default function LoginClient() {
  const router = useRouter();
  const { message } = useELApp();
  const loginStore = useAuthStore((state) => state.login);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Handle Google login
  const handleGoogleLogin = useCallback(() => {
    setIsGoogleLoading(true);
    // Redirect to Google OAuth with user context
    window.location.href = '/api/auth/google?context=user';
  }, []);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      senha: "",
      lembrarEmail: false,
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedEmail = window.localStorage.getItem(STORAGE_KEY);
    if (storedEmail) {
      setValue("email", storedEmail);
      setValue("lembrarEmail", true);
    }
  }, [setValue]);

  const onSubmit = useCallback(
    async (values: LoginInput) => {
      setIsLoading(true);
      setFormError(null);

      try {
        // Use the store's login method
        const result = await loginStore(values.email, values.senha);

        if (!result.success) {
          setFormError(result.error || "E-mail ou senha inválidos. Tente novamente.");
          setError("senha", {
            type: "manual",
            message: "Verifique as credenciais informadas.",
          });
          setIsLoading(false);
          return;
        }

        // Handle remember email
        if (typeof window !== "undefined") {
          if (values.lembrarEmail) {
            window.localStorage.setItem(STORAGE_KEY, values.email);
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }

        message.success("Login realizado com sucesso!");

        // Use full page navigation instead of client-side routing
        // This ensures cookies are properly processed by the browser
        // before any subsequent API calls are made
        if (isAdmin()) {
          window.location.href = "/admin";
        } else {
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Login error:", error);
        message.error("Não foi possível iniciar a sessão. Tente novamente em instantes.");
        setIsLoading(false);
      }
    },
    [loginStore, isAdmin, message, setError],
  );

  const formContent = useMemo(
    () => (
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit(onSubmit)}
        aria-live="polite"
        className={styles.form}
      >
        {formError ? (
          <ELAlert
            variant="danger"
            message={formError}
            showIcon
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="E-mail"
              htmlFor="login-email"
              required
              validateStatus={errors.email ? "error" : undefined}
              help={errors.email?.message}
            >
              <ELInput
                {...field}
                id="login-email"
                autoComplete="email"
                inputMode="email"
                placeholder="seuemail@empresa.com"
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
              htmlFor="login-senha"
              required
              validateStatus={errors.senha ? "error" : undefined}
              help={errors.senha?.message}
            >
              <ELInput.Password
                {...field}
                id="login-senha"
                autoComplete="current-password"
                placeholder="Digite sua senha"
                aria-invalid={Boolean(errors.senha)}
              />
            </ELFormItem>
          )}
        />

        <div className={styles.inlineRow}>
          <Controller
            name="lembrarEmail"
            control={control}
            render={({ field }) => (
              <ELCheckbox
                {...field}
                checked={field.value}
                aria-checked={field.value}
                className={styles.checkboxLabel}
              >
                Lembrar meu e-mail
              </ELCheckbox>
            )}
          />
          <Link href="/auth/forgot-password" className={styles.link}>
            Esqueci minha senha
          </Link>
        </div>

        <div className={styles.actionsColumn}>
          <ELButton
            variant="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={isLoading || isGoogleLoading}
            block
          >
            Entrar
          </ELButton>

          <div className={styles.divider}>ou</div>

          <ELButton
            block
            size="large"
            icon={<GoogleOutlined className={styles.googleIcon} />}
            className={styles.googleButton}
            onClick={handleGoogleLogin}
            loading={isGoogleLoading}
            disabled={isLoading || isGoogleLoading}
          >
            Continuar com Google
          </ELButton>
        </div>
      </Form>
    ),
    [
      control,
      errors.email,
      errors.senha,
      formError,
      handleSubmit,
      isLoading,
      isGoogleLoading,
      handleGoogleLogin,
      onSubmit,
    ],
  );

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <ELCard bodyGap="lg">
          <div className={styles.cardHeader}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-fundo-claro.png"
              alt="Multienvio"
              className={styles.logo}
            />
            <Typography.Title level={3} className={styles.title}>
              Bem-vindo de volta
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              Acesse o painel e gerencie seus envios com mais agilidade.
            </Typography.Paragraph>
          </div>
          {formContent}
          <Typography.Paragraph className={styles.footerText}>
            Ainda não tem conta? {" "}
            <Link href="/auth/cadastro" className={styles.link}>
              Crie agora mesmo
            </Link>
          </Typography.Paragraph>
        </ELCard>
      </div>
    </div>
  );
}
