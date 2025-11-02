"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Space,
  Typography,
} from "antd";
import { FormCard } from "@/components/ui/FormCard";
import {
  ResetPasswordSchema,
  type ResetPasswordAPIInput,
} from "@/lib/validation/auth";

type ResetResponse = {
  message: string;
  success: boolean;
};

async function resetRequest(
  payload: ResetPasswordAPIInput,
): Promise<ResetResponse> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro ao redefinir senha");
  }

  return data;
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const { message } = App.useApp();
  const [tokenError, setTokenError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordAPIInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
    },
  });

  // Set token from URL
  useEffect(() => {
    if (token) {
      setValue("token", token);
    }
  }, [token, setValue]);

  const mutation = useMutation<ResetResponse, Error, ResetPasswordAPIInput>({
    mutationFn: resetRequest,
    onSuccess: () => {
      setTokenError(null);
      message.success("Senha redefinida com sucesso! Redirecionando para o login...");
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    },
    onError: (error) => {
      const errorMessage = error.message;

      // Check for specific error messages
      if (errorMessage.includes("inválido") || errorMessage.includes("expirado") || errorMessage.includes("utilizado")) {
        setTokenError(errorMessage);
      } else {
        message.error(errorMessage || "Não foi possível redefinir a senha. Tente novamente.");
      }
    },
  });

  if (!token || typeof token !== "string") {
    return (
      <FormCard titulo="Link inválido">
        <Alert
          type="error"
          showIcon
          message="Link de redefinição inválido."
          description="Solicite uma nova redefinição para continuar."
        />
        <Button
          style={{ marginTop: 16 }}
          type="primary"
          href="/auth/forgot-password"
        >
          Solicitar novo link
        </Button>
      </FormCard>
    );
  }

  return (
    <FormCard
      titulo="Definir nova senha"
      subtitulo="Sua nova senha precisa atender aos requisitos de segurança."
      footer={
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          Precisa de ajuda?{" "}
          <Typography.Link href="/auth/forgot-password">
            Reenvie o link
          </Typography.Link>
        </Typography.Paragraph>
      }
    >
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        {tokenError ? (
          <Alert
            type="error"
            showIcon
            message={tokenError}
            description={
              <Typography.Link href="/auth/forgot-password">
                Solicitar um novo link de redefinição
              </Typography.Link>
            }
          />
        ) : null}

        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit((values) => mutation.mutate(values))}
        >
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="Nova senha"
                required
                validateStatus={errors.password ? "error" : ""}
                help={errors.password?.message}
              >
                <Input.Password
                  {...field}
                  autoComplete="new-password"
                  placeholder="Crie uma nova senha"
                  aria-invalid={Boolean(errors.password)}
                />
              </Form.Item>
            )}
          />

          <Alert
            type="info"
            showIcon
            message="Requisitos de senha"
            description={
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                <li>Mínimo de 8 caracteres</li>
                <li>Pelo menos uma letra maiúscula</li>
                <li>Pelo menos uma letra minúscula</li>
                <li>Pelo menos um número</li>
                <li>Pelo menos um caractere especial</li>
              </ul>
            }
            style={{ marginBottom: 16 }}
          />

          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            block
          >
            Atualizar senha
          </Button>
        </Form>
      </Space>
    </FormCard>
  );
}
