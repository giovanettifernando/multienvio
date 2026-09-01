"use client";

import { Controller, useFormContext } from "react-hook-form";
import {
  ELButton,
  ELCard,
  ELInput,
  ELSpace,
  ELTypography,
} from "@/shared/ui";
import { ExportOutlined } from "@ant-design/icons";
import { isValidDceKey } from "@/shared/validation/dce";
import type { FinalizeFormValues } from "@/shared/types/quoteFinalize";

const Typography = ELTypography;
const { Text } = Typography;

/**
 * Portal nacional da DC-e. Dali se chega ao emissor e aos aplicativos.
 *
 * O FAQ oficial indica `www.dce.receita.pr.gov.br` como emissor Web, mas em
 * 01/09/2026 esse endereço não resolve DNS e o `dce.receita.pr.gov.br` não
 * responde. O portal nacional está no ar e é estável, então é para lá que
 * mandamos o cliente.
 */
const PORTAL_DCE = "https://dfe-portal.svrs.rs.gov.br/Dce";

/**
 * A DC-e é emitida pelo cliente, fora da plataforma: no app ou no emissor Web
 * do Fisco (pessoa física), ou no sistema fiscal próprio (pessoa jurídica, que
 * perde o acesso ao app do Fisco em 31/10/2026). Ele volta com 44 dígitos.
 *
 * Não há como preencher nada por ele — o emissor é da SEFAZ. O que dá para
 * fazer é validar a chave na hora, em vez de deixar o erro aparecer só na
 * cobrança.
 */
export function DceKeyField() {
  const { control } = useFormContext<FinalizeFormValues>();

  return (
    <ELCard
      size="small"
      header={{ title: "Declaração de Conteúdo eletrônica (DC-e)" }}
    >
      <ELSpace orientation="vertical" size={12} style={{ width: "100%" }}>
        <Text style={{ fontSize: 13 }}>
          Emita a DC-e no portal da SEFAZ — no site ou pelo aplicativo — e cole
          aqui a chave de 44 dígitos. Sem ela não é possível concluir o envio.
        </Text>

        <ELButton
          size="small"
          icon={<ExportOutlined />}
          onClick={() => window.open(PORTAL_DCE, "_blank", "noopener")}
        >
          Abrir portal da DC-e
        </ELButton>

        <Controller
          control={control}
          name="document.dceKey"
          render={({ field, fieldState }) => {
            const valor = field.value ?? "";
            const digitos = valor.replace(/\D/g, "");
            const completa = digitos.length === 44;
            const valida = completa && isValidDceKey(digitos);

            return (
              <div>
                <ELInput
                  value={valor}
                  placeholder="Chave da DC-e (44 dígitos)"
                  status={completa && !valida ? "error" : undefined}
                  onBlur={field.onBlur}
                  onChange={(e) => field.onChange(e.target.value)}
                />
                {completa && !valida && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Chave inválida. Se o documento for uma nota fiscal, ela não
                    serve aqui.
                  </Text>
                )}
                {!completa && digitos.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {digitos.length} de 44 dígitos
                  </Text>
                )}
                {valida && (
                  <Text type="success" style={{ fontSize: 12 }}>
                    Chave válida.
                  </Text>
                )}
                {fieldState.error && digitos.length === 0 && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {fieldState.error.message}
                  </Text>
                )}
              </div>
            );
          }}
        />
      </ELSpace>
    </ELCard>
  );
}

export default DceKeyField;
