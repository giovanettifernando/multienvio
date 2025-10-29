"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";

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

type RegisterResponse = {
  id: string;
  name: string;
  email: string;
};

type CadastroFormValues = z.infer<typeof cadastroSchema>;


async function registerUser(
  payload: CadastroFormValues,
): Promise<RegisterResponse> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw response;
  }

  return response.json();
}

export default function CadastroPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const setUser = useAuthStore((state) => state.setUser);

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

  const mutation = useMutation<RegisterResponse, Response, CadastroFormValues>({
    mutationFn: registerUser,
    onSuccess: (data) => {
      setUser(data);
      router.push("/auth/confirmacao");
    },
    onError: async (error) => {
      if (error.status === 409) {
        setError("email", {
          type: "manual",
          message: "Este e-mail já está cadastrado. Faça login para continuar.",
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
                const campo = issue.campo as keyof CadastroFormValues;
                setError(campo, {
                  type: "server",
                  message: issue.mensagem,
                });
              },
            );
            return;
          }
        } catch {
          // continua para mensagem genérica
        }
      }

      message.error(
        "Não foi possível concluir seu cadastro. Tente novamente.",
      );
    },
  });

  const onSubmit = useCallback(
    (values: CadastroFormValues) => {
      mutation.mutate(values);
    },
    [mutation],
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
            loading={mutation.isPending}
            block
          >
            Criar conta
          </Button>
        </Form.Item>
      </Form>
    </FormCard>
  );
}
