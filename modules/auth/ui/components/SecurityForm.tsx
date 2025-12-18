"use client";

import React from "react";
import { App, Space } from "antd";
import { ELButton, ELCard, ELFormItem, ELInput } from "@/shared/ui";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { usePasswordChange } from "@/modules/account/ui/hooks";

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
    <ELCard header={{ title: "Segurança" }}>
      <form onSubmit={handleSubmit}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <ELFormItem
                label="Senha atual"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <ELInput.Password {...field} placeholder="Senha atual" />
              </ELFormItem>
            )}
          />
          <Controller
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <ELFormItem
                label="Nova senha"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <ELInput.Password {...field} placeholder="Nova senha" />
              </ELFormItem>
            )}
          />
          <Controller
            name="confirmNewPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <ELFormItem
                label="Confirmar nova senha"
                required
                validateStatus={fieldState.error ? "error" : undefined}
                help={fieldState.error?.message}
              >
                <ELInput.Password {...field} placeholder="Repita a nova senha" />
              </ELFormItem>
            )}
          />
          <ELButton
            variant="primary"
            htmlType="submit"
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Atualizar senha
          </ELButton>
        </Space>
      </form>
    </ELCard>
  );
}
