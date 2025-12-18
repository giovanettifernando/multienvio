"use client";

import React from "react";
import { App, Button, Card, Form, Input, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { usePasswordChange } from "@/hooks/useAccount";

const passwordPolicy = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres.")
  .regex(/[A-Z]/u, "Inclua ao menos uma letra maiúscula.")
  .regex(/[a-z]/u, "Inclua ao menos uma letra minúscula.")
  .regex(/\d/u, "Inclua ao menos um número.");

const securitySchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual."),
    newPassword: passwordPolicy,
    confirmNewPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .superRefine((values, ctx) => {
    if (values.newPassword !== values.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "As senhas não coincidem.",
      });
    }
  });

export type SecurityFormValues = z.infer<typeof securitySchema>;

export default function SecurityForm() {
  const { message } = App.useApp();
  const router = useRouter();
  const mutation = usePasswordChange();

  const form = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => {
        message.success("Senha atualizada com sucesso. Redirecionando para o login...");
        form.reset();

        // Redirecionar para a tela de login após 1.5 segundos
        setTimeout(() => {
          router.push("/auth/login");
        }, 1500);
      },
      onError: (error) => {
        message.error(
          error instanceof Error
            ? error.message
            : "Não foi possível alterar a senha.",
        );
      },
    });
  });

  return (
    <Card title="Segurança">
      <form onSubmit={handleSubmit}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Senha atual"
                required
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input.Password {...field} placeholder="Senha atual" />
              </Form.Item>
            )}
          />
          <Controller
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nova senha"
                required
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input.Password {...field} placeholder="Nova senha" />
              </Form.Item>
            )}
          />
          <Controller
            name="confirmNewPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Confirmar nova senha"
                required
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input.Password {...field} placeholder="Repita a nova senha" />
              </Form.Item>
            )}
          />
          <Button
            type="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Atualizar senha
          </Button>
        </Space>
      </form>
    </Card>
  );
}
