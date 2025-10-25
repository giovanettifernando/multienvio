"use client";

import { Controller, useWatch, type Control, type FieldErrors } from "react-hook-form";
import { Form, Input, Radio, Select } from "antd";
import type {
  CompanyWizardData,
  EmpresaData,
  PessoaData,
} from "@/lib/validation/company";
import { maskCNPJ, maskCPF, onlyDigits } from "@/lib/masks";
import { regimeTributarioOptions } from "@/lib/validation/company";

const regimeOptions = regimeTributarioOptions.map((value) => ({
  label:
    value === "SIMPLES"
      ? "Simples Nacional"
      : value === "PRESUMIDO"
        ? "Lucro Presumido"
        : "Lucro Real",
  value,
}));

type Props = {
  control: Control<CompanyWizardData, unknown, CompanyWizardData>;
  tipoPessoa: "PF" | "PJ";
  empresaErrors?: FieldErrors<EmpresaData>;
  pessoaErrors?: FieldErrors<PessoaData>;
};

export function CompanyStepEmpresa({
  control,
  tipoPessoa,
  empresaErrors,
  pessoaErrors,
}: Props) {
  const selectedTipo =
    useWatch({ control, name: "tipoPessoa" }) ?? tipoPessoa;

  const currentEmpresaErrors = empresaErrors ?? {};
  const currentPessoaErrors = pessoaErrors ?? {};

  return (
    <>
      <Controller
        name="tipoPessoa"
        control={control}
        render={({ field }) => (
          <Form.Item label="Tipo de pessoa" required>
            <Radio.Group {...field} value={field.value ?? tipoPessoa}>
              <Radio.Button value="PJ">Pessoa Jurídica</Radio.Button>
              <Radio.Button value="PF">Pessoa Física</Radio.Button>
            </Radio.Group>
          </Form.Item>
        )}
      />

      {selectedTipo === "PF" ? (
        <>
          <Controller
            name="pessoa.nomeCompleto"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="Nome completo"
                required
                validateStatus={currentPessoaErrors.nomeCompleto ? "error" : ""}
                help={currentPessoaErrors.nomeCompleto?.message}
              >
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Nome completo do remetente"
                  aria-invalid={Boolean(currentPessoaErrors.nomeCompleto)}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="pessoa.cpf"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="CPF"
                required
                validateStatus={currentPessoaErrors.cpf ? "error" : ""}
                help={currentPessoaErrors.cpf?.message}
              >
                <Input
                  {...field}
                  value={maskCPF(field.value ?? "")}
                  onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  aria-invalid={Boolean(currentPessoaErrors.cpf)}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="pessoa.rg"
            control={control}
            render={({ field }) => (
              <Form.Item label="RG (opcional)">
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Informe caso deseje registrar"
                />
              </Form.Item>
            )}
          />
        </>
      ) : (
        <>
          <Controller
            name="empresa.razao"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="Razão social"
                required
                validateStatus={currentEmpresaErrors.razao ? "error" : ""}
                help={currentEmpresaErrors.razao?.message}
              >
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Informe a razão social"
                  aria-invalid={Boolean(currentEmpresaErrors.razao)}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="empresa.fantasia"
            control={control}
            render={({ field }) => (
              <Form.Item label="Nome fantasia (opcional)">
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Como seus clientes conhecem a empresa"
                />
              </Form.Item>
            )}
          />

          <Controller
            name="empresa.cnpj"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="CNPJ"
                required
                validateStatus={currentEmpresaErrors.cnpj ? "error" : ""}
                help={currentEmpresaErrors.cnpj?.message}
              >
                <Input
                  {...field}
                  value={maskCNPJ(field.value ?? "")}
                  onChange={(event) => field.onChange(onlyDigits(event.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  aria-invalid={Boolean(currentEmpresaErrors.cnpj)}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="empresa.ie"
            control={control}
            render={({ field }) => (
              <Form.Item label="Inscrição estadual (opcional)">
                <Input
                  {...field}
                  value={field.value ?? ""}
                  placeholder="Informe caso possua inscrição estadual"
                />
              </Form.Item>
            )}
          />

          <Controller
            name="empresa.regime"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="Regime tributário"
                required
                validateStatus={currentEmpresaErrors.regime ? "error" : ""}
                help={currentEmpresaErrors.regime?.message}
              >
                <Select
                  {...field}
                  value={field.value ?? "SIMPLES"}
                  options={regimeOptions}
                  placeholder="Selecione o regime tributário"
                />
              </Form.Item>
            )}
          />
        </>
      )}
    </>
  );
}
