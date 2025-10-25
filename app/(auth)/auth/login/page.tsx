"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  Input,
  Space,
  Typography,
} from "antd";
import { FormCard } from "@/components/ui/FormCard";
import {
  loginSchema,
  type LoginInput,
} from "@/lib/validation/auth";
import { useAuthStore } from "@/stores/auth";

type LoginResponse = {
  id: string;
  name: string;
  email: string;
  token: string;
};

async function loginRequest(
  payload: LoginInput,
): Promise<LoginResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw response;
  }

  return response.json();
}

const STORAGE_KEY = "enviolegal:last-email";

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const login = useAuthStore((state) => state.login);
  const [formError, setFormError] = useState<string | null>(null);

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

  const mutation = useMutation<LoginResponse, Response, LoginInput>({
    mutationFn: loginRequest,
    onSuccess: (data, variables) => {
      setFormError(null);
      login(data);

      if (typeof window !== "undefined") {
        if (variables.lembrarEmail) {
          window.localStorage.setItem(STORAGE_KEY, data.email);
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      router.replace("/");
    },
    onError: async (error) => {
      if (error.status === 423) {
        setFormError(null);
        message.warning(
          "Sua conta ainda não foi confirmada. Verifique seu e-mail.",
        );
        router.push("/auth/confirmacao");
        return;
      }

      if (error.status === 401) {
        setFormError("E-mail ou senha inválidos. Tente novamente.");
        setError("senha", {
          type: "manual",
          message: "Verifique as credenciais informadas.",
        });
        return;
      }

      if (error.status === 400) {
        try {
          const body = await error.json();
          if (Array.isArray(body?.erros)) {
            body.erros.forEach(
              (issue: { campo?: string; mensagem?: string }) => {
                if (!issue?.campo || !issue?.mensagem) return;
                const campo = issue.campo as keyof LoginInput;
                setError(campo, {
                  type: "server",
                  message: issue.mensagem,
                });
              },
            );
            return;
          }
        } catch {
          // segue para mensagem genérica
        }
      }

      message.error(
        "Não foi possível iniciar a sessão. Tente novamente em instantes.",
      );
    },
  });

  const onSubmit = useCallback(
    (values: LoginInput) => {
      mutation.mutate(values);
    },
    [mutation],
  );

  return (
    <FormCard
      titulo="Entrar"
      subtitulo="Acesse o painel e gerencie todos os envios em um só lugar."
      footer={
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          Ainda não tem conta?{" "}
          <Link href="/auth/cadastro">Crie agora mesmo</Link>
        </Typography.Paragraph>
      }
    >
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={handleSubmit(onSubmit)}
        aria-live="polite"
      >
        {formError ? (
          <Alert
            type="error"
            message={formError}
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Form.Item
              label="E-mail"
              required
              validateStatus={errors.email ? "error" : ""}
              help={errors.email?.message}
            >
              <Input
                {...field}
                autoComplete="email"
                inputMode="email"
                placeholder="seuemail@empresa.com"
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
                autoComplete="current-password"
                placeholder="Digite sua senha"
                aria-invalid={Boolean(errors.senha)}
              />
            </Form.Item>
          )}
        />

        <Space
          direction="horizontal"
          align="center"
          style={{ width: "100%", justifyContent: "space-between" }}
        >
          <Controller
            name="lembrarEmail"
            control={control}
            render={({ field }) => (
              <Checkbox
                {...field}
                checked={field.value}
                aria-checked={field.value}
              >
                Lembrar meu e-mail
              </Checkbox>
            )}
          />
          <Link href="/auth/esqueci-senha">Esqueci minha senha</Link>
        </Space>

        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            block
          >
            Entrar
          </Button>
        </Space>
      </Form>
    </FormCard>
  );
}
