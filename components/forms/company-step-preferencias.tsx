"use client";

import { Controller, type Control, type FieldErrors } from "react-hook-form";
import {
  Checkbox,
  Form,
  Input,
} from "antd";
import type { CompanyWizardData, PreferenciasData } from "@/lib/validation/company";

type Props = {
  control: Control<CompanyWizardData, unknown, CompanyWizardData>;
  errors?: FieldErrors<PreferenciasData>;
};

export function CompanyStepPreferencias({ control, errors }: Props) {
  const preferenciasErrors = errors ?? {};

  return (
    <>
      <Controller
        name="preferencias.remetente"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="Nome do remetente"
            required
            validateStatus={preferenciasErrors.remetente ? "error" : ""}
            help={preferenciasErrors.remetente?.message}
          >
            <Input
              {...field}
              placeholder="Nome impresso nas etiquetas"
              aria-invalid={Boolean(preferenciasErrors.remetente)}
            />
          </Form.Item>
        )}
      />

      <Controller
        name="preferencias.emailNotificacoes"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="E-mail para notificações"
            required
            validateStatus={preferenciasErrors.emailNotificacoes ? "error" : ""}
            help={preferenciasErrors.emailNotificacoes?.message}
          >
            <Input
              {...field}
              placeholder="logistica@empresa.com"
              aria-invalid={Boolean(preferenciasErrors.emailNotificacoes)}
            />
          </Form.Item>
        )}
      />

      <Controller
        name="preferencias.aceite"
        control={control}
        render={({ field }) => (
          <Form.Item
            required
            validateStatus={preferenciasErrors.aceite ? "error" : ""}
            help={preferenciasErrors.aceite?.message}
            valuePropName="checked"
          >
            <Checkbox
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              aria-invalid={Boolean(preferenciasErrors.aceite)}
            >
              Li e concordo com os termos e a Política de Privacidade
            </Checkbox>
          </Form.Item>
        )}
      />
    </>
  );
}
