"use client";

import { Card, Form, InputNumber } from "antd";
import { Controller, Control } from "react-hook-form";
import type { QuoteFormValues } from "./quoteFormSchema";

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
        render={({ field, fieldState }) => (
          <Form.Item
            label="Valor do seguro (R$)"
            validateStatus={fieldState.error ? "error" : undefined}
            help={fieldState.error?.message}
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              {...field}
              value={field.value ?? undefined}
              placeholder="Opcional"
              min={0}
              step={100}
              style={{ width: "100%" }}
              onChange={(val) => field.onChange(val ?? undefined)}
            />
          </Form.Item>
        )}
      />
    </Card>
  );
}
