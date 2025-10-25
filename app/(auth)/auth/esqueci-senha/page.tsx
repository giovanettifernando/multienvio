"use client";

import { useState } from "react";
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
import { EmailPreview } from "@/components/dev/EmailPreview";
import {
  forgotSchema,
  type ForgotInput,
} from "@/lib/validation/auth";

type ForgotResponse = {
  ok: true;
  previewUrl?: string;
};

async function forgotRequest(
  payload: ForgotInput,
): Promise<ForgotResponse> {
  const response = await fetch("/api/auth/forgot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw response;
  }

  return response.json();
}

export default function ForgotPasswordPage() {
  const { message } = App.useApp();
  const [confirmed, setConfirmed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
    reset,
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation<ForgotResponse, Response, ForgotInput>({
    mutationFn: forgotRequest,
    onSuccess: (data) => {
      setConfirmed(true);
      setPreviewUrl(data.previewUrl);
      reset({ email: "" });
    },
    onError: async (error) => {
      if (error.status === 400) {
        try {
          const body = await error.json();
          if (Array.isArray(body?.erros)) {
            body.erros.forEach(
              (issue: { campo?: string; mensagem?: string }) => {
                if (!issue?.campo || !issue?.mensagem) return;
                const campo = issue.campo as keyof ForgotInput;
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
        "Não foi possível enviar as instruções. Tente novamente.",
      );
    },
  });

  return (
    <FormCard
      titulo="Esqueci minha senha"
      subtitulo="Informe seu e-mail para receber o link de redefinição."
      footer={
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          Lembrou da senha?{" "}
          <Typography.Link href="/auth/login">Voltar ao login</Typography.Link>
        </Typography.Paragraph>
      }
    >
      {confirmed ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="success"
            message="Se este e-mail estiver cadastrado, enviaremos instruções em instantes."
            description="Verifique sua caixa de entrada e o spam. O link expira em 15 minutos."
            showIcon
          />
          <EmailPreview
            previewUrl={previewUrl}
            message="Use este link para testar o fluxo de redefinição durante o desenvolvimento."
          />
          <Button type="primary" onClick={() => setConfirmed(false)}>
            Enviar novamente
          </Button>
        </Space>
      ) : (
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit((values) => mutation.mutate(values))}
        >
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
                  placeholder="voce@empresa.com"
                  aria-invalid={Boolean(errors.email)}
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
            Enviar instruções
          </Button>
        </Form>
      )}
    </FormCard>
  );
}
