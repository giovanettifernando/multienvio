"use client";

import { Flex, Space, Switch, Typography } from "antd";
import { Controller, Control } from "react-hook-form";
import type { QuoteFormValues } from "./quoteFormSchema";

interface PickupToggleProps {
  control: Control<QuoteFormValues>;
  disabled?: boolean;
  onPickupChange?: (checked: boolean) => void;
}

/**
 * Toggle to request pickup at origin
 */
export function PickupToggle({ control, disabled, onPickupChange }: PickupToggleProps) {
  return (
    <Controller
      control={control}
      name="coleta"
      render={({ field }) => (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Flex align="center" gap={12}>
            <Switch
              checked={field.value}
              onChange={(checked) => {
                field.onChange(checked);
                onPickupChange?.(checked);
              }}
              disabled={disabled}
            />
            <div>
              <Typography.Text>Solicitar coleta na origem</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Disponível para CEPs com cobertura de coleta
              </Typography.Text>
            </div>
          </Flex>
        </Space>
      )}
    />
  );
}
