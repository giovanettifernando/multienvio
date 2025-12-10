"use client";

import { Card, Form, InputNumber, Typography } from "antd";
import { Controller, Control } from "react-hook-form";
import type { QuoteFormValues } from "./quoteFormSchema";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/lib/utils/format";

const { Text } = Typography;

// Valor mínimo para seguro (Correios SEDEX)
const VALOR_MINIMO_SEGURO = 25.63;

interface InsuranceInputProps {
  control: Control<QuoteFormValues>;
}

/**
 * Insurance value input component
 */
export function InsuranceInput({ control }: InsuranceInputProps) {
  return (
    <Card size="small">
      <Controller
        control={control}
        name="seguroValor"
        render={({ field, fieldState }) => {
          const valorAtual = field.value ?? 0;
          const showMinWarning = valorAtual > 0 && valorAtual < VALOR_MINIMO_SEGURO;

          return (
            <Form.Item
              label="Valor do seguro (R$)"
              validateStatus={fieldState.error ? "error" : showMinWarning ? "warning" : undefined}
              help={
                fieldState.error?.message ||
                (showMinWarning
                  ? `Valor mínimo para seguro: R$ ${VALOR_MINIMO_SEGURO.toFixed(2).replace('.', ',')} (SEDEX). PAC não aceita seguro.`
                  : undefined)
              }
              style={{ marginBottom: 0 }}
              extra={
                !showMinWarning && !fieldState.error && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Mínimo R$ 25,63 (somente SEDEX). PAC não aceita seguro.
                  </Text>
                )
              }
            >
              <InputNumber
                {...field}
                value={field.value ?? undefined}
                placeholder="Opcional"
                min={0}
                step={100}
                precision={2}
                prefix="R$"
                decimalSeparator=","
                formatter={inputNumberFormatterBRL}
                parser={inputNumberParserBRL}
                style={{ width: "100%" }}
                onChange={(val) => field.onChange(val ?? undefined)}
              />
            </Form.Item>
          );
        }}
      />
    </Card>
  );
}
