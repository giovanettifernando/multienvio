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
import {
  ForgotPasswordSchema,
  type ForgotPasswordAPIInput,
} from "@/lib/validation/auth";

type ForgotResponse = {
  message: string;
};

async function forgotRequest(
  payload: ForgotPasswordAPIInput,
): Promise<ForgotResponse> {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao enviar instruções");
  }

  return response.json();
}

export default function ForgotPasswordClient() {
  const { message } = App.useApp();
  const [confirmed, setConfirmed] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ForgotPasswordAPIInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation<ForgotResponse, Error, ForgotPasswordAPIInput>({
    mutationFn: forgotRequest,
    onSuccess: () => {
      setConfirmed(true);
      reset({ email: "" });
    },
    onError: (error) => {
      message.error(
        error.message || "Não foi possível enviar as instruções. Tente novamente.",
      );
    },
  });

  return (
    <FormCard
      titulo="Redefinir senha"
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
            message="Instruções enviadas!"
            description="Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha. Verifique sua caixa de entrada e o spam. O link expira em 1 hora."
            showIcon
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
            Enviar link de redefinição
          </Button>
        </Form>
      )}
    </FormCard>
  );
}
