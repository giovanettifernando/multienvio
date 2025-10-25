"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { PasswordStrength } from "@/components/form/PasswordStrength";
import {
  resetSchema,
  type ResetInput,
} from "@/lib/validation/auth";

type ResetResponse = {
  ok: true;
};

type ResetErrorBody = {
  code?: string;
  mensagem?: string;
  erros?: Array<{ campo?: string; mensagem?: string }>;
};

async function resetRequest(payload: {
  token: string;
  senha: string;
}): Promise<ResetResponse> {
  const response = await fetch("/api/auth/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw response;
  }

  return response.json();
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const { message } = App.useApp();
  const [tokenError, setTokenError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      senha: "",
      confirmarSenha: "",
    },
  });

  const senhaAtual = watch("senha") ?? "";

  const mutation = useMutation<ResetResponse, Response, ResetInput>({
    mutationFn: async (values) => resetRequest({ token, senha: values.senha }),
    onSuccess: () => {
      setTokenError(null);
      message.success("Senha alterada com sucesso. Faça login para continuar.");
      router.replace("/auth/login");
    },
    onError: async (error) => {
      let body: ResetErrorBody | undefined;
      try {
        body = await error.json();
      } catch {
        // noop
      }

      if (error.status === 400 && body?.code === "TOKEN_INVALID") {
        setTokenError(
          body.mensagem ?? "O link de redefinição expirou ou é inválido.",
        );
        return;
      }

      if (error.status === 400 && Array.isArray(body?.erros)) {
        body.erros.forEach((issue) => {
          if (!issue.campo || !issue.mensagem) return;
          const campo = issue.campo as keyof ResetInput;
          setError(campo, {
            type: "server",
            message: issue.mensagem,
          });
        });
        return;
      }

      message.error(
        "Não foi possível redefinir a senha. Tente novamente mais tarde.",
      );
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
          href="/auth/esqueci-senha"
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
          <Typography.Link href="/auth/esqueci-senha">
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
              <Typography.Link href="/auth/esqueci-senha">
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
            name="senha"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="Nova senha"
                required
                validateStatus={errors.senha ? "error" : ""}
                help={errors.senha?.message}
              >
                <Input.Password
                  {...field}
                  autoComplete="new-password"
                  placeholder="Crie uma nova senha"
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
                label="Confirmar nova senha"
                required
                validateStatus={errors.confirmarSenha ? "error" : ""}
                help={errors.confirmarSenha?.message}
              >
                <Input.Password
                  {...field}
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                  aria-invalid={Boolean(errors.confirmarSenha)}
                  onPaste={(event) => event.preventDefault()}
                />
              </Form.Item>
            )}
          />

          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            block
          >
            Salvar nova senha
          </Button>
        </Form>
      </Space>
    </FormCard>
  );
}
