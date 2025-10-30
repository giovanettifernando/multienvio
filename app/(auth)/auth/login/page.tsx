"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Alert from "antd/es/alert";
import App from "antd/es/app";
import Checkbox from "antd/es/checkbox";
import Form from "antd/es/form";
import Typography from "antd/es/typography";
import { FormCard } from "@/components/ui/FormCard";
import { ELButton } from "@/components/ui/ELButton";
import { ELCard } from "@/components/ui/ELCard";
import { ELFormItem } from "@/components/ui/ELFormItem";
import { ELInput } from "@/components/ui/ELInput";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
import { spacing } from "@/src/styles/theme";
import {
  loginSchema,
  type LoginInput,
} from "@/lib/validation/auth";
import { useAuthStore } from "@/stores/auth";
import styles from "./login.module.css";

const STORAGE_KEY = "enviolegal:last-email";

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const loginStore = useAuthStore((state) => state.login);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

        // Redirect based on role
        if (isAdmin()) {
          router.replace("/admin");
        } else {
          router.replace("/");
        }
      } catch (error) {
        console.error("Login error:", error);
        message.error("Não foi possível iniciar a sessão. Tente novamente em instantes.");
        setIsLoading(false);
      }
    },
    [loginStore, isAdmin, router, message, setError],
  );

  const formContent = useMemo(
    () => (
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit(onSubmit)}
        aria-live="polite"
        className={NEW_THEME_ENABLED ? styles.form : undefined}
      >
        {formError ? (
          <Alert
            type="error"
            message={formError}
            showIcon
            style={
              NEW_THEME_ENABLED
                ? { marginBottom: spacing.md }
                : { marginBottom: 16 }
            }
          />
        ) : null}

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <ELFormItem
              label="E-mail"
              required
              validateStatus={errors.email ? "error" : undefined}
              help={errors.email?.message}
            >
              <ELInput
                {...field}
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
              required
              validateStatus={errors.senha ? "error" : undefined}
              help={errors.senha?.message}
            >
              <ELInput.Password
                {...field}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                aria-invalid={Boolean(errors.senha)}
              />
            </ELFormItem>
          )}
        />

        <div className={NEW_THEME_ENABLED ? styles.inlineRow : undefined}>
          <Controller
            name="lembrarEmail"
            control={control}
            render={({ field }) => (
              <Checkbox
                {...field}
                checked={field.value}
                aria-checked={field.value}
                className={NEW_THEME_ENABLED ? styles.checkboxLabel : undefined}
              >
                Lembrar meu e-mail
              </Checkbox>
            )}
          />
          <Link href="/auth/esqueci-senha" className={NEW_THEME_ENABLED ? styles.link : undefined}>
            Esqueci minha senha
          </Link>
        </div>

        <div className={NEW_THEME_ENABLED ? styles.actionsColumn : undefined}>
          <ELButton
            variant="primary"
            htmlType="submit"
            loading={isLoading}
            disabled={isLoading}
            block
          >
            Entrar
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
      onSubmit,
    ],
  );

  if (!NEW_THEME_ENABLED) {
    return (
      <FormCard
        titulo="Entrar"
        subtitulo="Acesse o painel e gerencie todos os envios em um só lugar."
        footer={
          <Typography.Paragraph style={{ margin: 0 }} type="secondary">
            Ainda não tem conta? <Link href="/auth/cadastro">Crie agora mesmo</Link>
          </Typography.Paragraph>
        }
      >
        {formContent}
      </FormCard>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.panel}>
        <ELCard
          header={{
            title: "Bem-vindo de volta",
            description: "Acesse o painel e gerencie seus envios com mais agilidade.",
          }}
          bodyGap="lg"
        >
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
