"use client";

import { useMemo } from "react";
import {
  Controller,
  FormProvider,
  useForm,
  type Control,
  type FieldErrors,
} from "react-hook-form";
import { Form, Input, Select, Space } from "antd";
import { CepInput } from "@/components/form/CepInput";
import type { CompanyWizardData, EnderecoData } from "@/lib/validation/company";
import {
  normalizePhoneInput,
} from "@/lib/masks";

const ufOptions = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
].map((value) => ({ label: value, value }));

type Props = {
  control: Control<CompanyWizardData, unknown, CompanyWizardData>;
  errors?: FieldErrors<EnderecoData>;
  cepLoading?: boolean;
};

export function CompanyStepEndereco({
  control,
  errors,
  cepLoading,
}: Props) {
  const enderecoErrors = errors ?? {};
  const cepHelp = useMemo(() => {
    if (cepLoading) return "Consultando CEP...";
    return enderecoErrors.cep?.message;
  }, [cepLoading, enderecoErrors.cep?.message]);

  return (
    <>
      <CepInput
        name="endereco.cep"
        label="CEP"
        targets={{
          city: "endereco.cidade",
          state: "endereco.uf",
          street: "endereco.logradouro",
          neighborhood: "endereco.bairro",
        }}
      />

      <Controller
        name="endereco.logradouro"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="Logradouro"
            required
            validateStatus={enderecoErrors.logradouro ? "error" : ""}
            help={enderecoErrors.logradouro?.message}
          >
            <Input
              {...field}
              placeholder="Rua, avenida, etc"
              aria-invalid={Boolean(enderecoErrors.logradouro)}
            />
          </Form.Item>
        )}
      />

      <Space size="large" direction="horizontal" style={{ width: "100%" }} wrap>
        <Controller
          name="endereco.numero"
          control={control}
          render={({ field }) => (
            <Form.Item
              style={{ flex: 1 }}
              label="Número"
              required
              validateStatus={enderecoErrors.numero ? "error" : ""}
              help={enderecoErrors.numero?.message}
            >
              <Input
                {...field}
                placeholder="Número"
                aria-invalid={Boolean(enderecoErrors.numero)}
              />
            </Form.Item>
          )}
        />
        <Controller
          name="endereco.complemento"
          control={control}
          render={({ field }) => (
            <Form.Item style={{ flex: 1 }} label="Complemento (opcional)">
              <Input {...field} value={field.value ?? ""} placeholder="Apartamento, sala" />
            </Form.Item>
          )}
        />
      </Space>

      <Controller
        name="endereco.bairro"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="Bairro"
            required
            validateStatus={enderecoErrors.bairro ? "error" : ""}
            help={enderecoErrors.bairro?.message}
          >
            <Input
              {...field}
              placeholder="Bairro"
              aria-invalid={Boolean(enderecoErrors.bairro)}
            />
          </Form.Item>
        )}
      />

      <Space size="large" direction="horizontal" style={{ width: "100%" }} wrap>
        <Controller
          name="endereco.cidade"
          control={control}
          render={({ field }) => (
            <Form.Item
              style={{ flex: 1 }}
              label="Cidade"
              required
              validateStatus={enderecoErrors.cidade ? "error" : ""}
              help={enderecoErrors.cidade?.message}
            >
              <Input
                {...field}
                placeholder="Cidade"
                aria-invalid={Boolean(enderecoErrors.cidade)}
              />
            </Form.Item>
          )}
        />
        <Controller
          name="endereco.uf"
          control={control}
          render={({ field }) => (
            <Form.Item
              style={{ width: 120 }}
              label="UF"
              required
              validateStatus={enderecoErrors.uf ? "error" : ""}
              help={enderecoErrors.uf?.message}
            >
              <Select {...field} options={ufOptions} placeholder="UF" />
            </Form.Item>
          )}
        />
      </Space>

      <Controller
        name="endereco.telefone"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="Telefone (opcional)"
            validateStatus={enderecoErrors.telefone ? "error" : ""}
            help={enderecoErrors.telefone?.message}
          >
            <Input
              {...field}
              value={field.value ?? ""}
              onChange={(event) =>
                field.onChange(normalizePhoneInput(event.target.value))
              }
              placeholder="(11) 91234-5678"
              aria-invalid={Boolean(enderecoErrors.telefone)}
            />
          </Form.Item>
        )}
      />
    </>
  );
}
