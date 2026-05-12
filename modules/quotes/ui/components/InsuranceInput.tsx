"use client";

import { ELFlexAntd, ELInputNumber, ELTooltip, ELTypography } from '@/shared/ui';
const Flex = ELFlexAntd;
const InputNumber = ELInputNumber;
const Tooltip = ELTooltip;
const Typography = ELTypography;
import { QuestionCircleOutlined } from "@ant-design/icons";
import { Controller, Control } from "react-hook-form";
import type { QuoteFormValues } from "./quoteFormSchema";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/shared/utils/format";

const { Text } = Typography;

// Valor mínimo para seguro (Correios SEDEX)
const VALOR_MINIMO_SEGURO = 25.63;

interface InsuranceInputProps {
  control: Control<QuoteFormValues>;
}

/**
 * Insurance value input component - inline layout
 */
export function InsuranceInput({ control }: InsuranceInputProps) {
  return (
    <Controller
      control={control}
      name="seguroValor"
      render={({ field, fieldState }) => {
        const valorAtual = field.value ?? 0;
        const showMinWarning = valorAtual > 0 && valorAtual < VALOR_MINIMO_SEGURO;
        const hasError = fieldState.error || showMinWarning;

        return (
          <div>
            <Flex align="center" gap={8}>
              <Flex align="center" gap={4}>
                <Tooltip title="Valor que será coberto pelo seguro">
                  <QuestionCircleOutlined style={{ fontSize: 12, color: "#667085", cursor: "help" }} />
                </Tooltip>
                <Text style={{ fontSize: 13 }}>Valor do seguro</Text>
              </Flex>
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
                status={hasError ? "warning" : undefined}
                style={{ width: 140, fontSize: 13 }}
                onChange={(val) => field.onChange(val ?? undefined)}
              />
            </Flex>
            {hasError && (
              <Text type="warning" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                {fieldState.error?.message ||
                  `Mínimo R$ ${VALOR_MINIMO_SEGURO.toFixed(2).replace('.', ',')} (SEDEX). PAC não aceita seguro.`}
              </Text>
            )}
          </div>
        );
      }}
    />
  );
}
