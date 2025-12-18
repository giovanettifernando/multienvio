"use client";

import { Radio, Typography } from "antd";

interface DestinationModeSelectorProps {
  mode: "manual" | "recipient";
  onChange: (mode: "manual" | "recipient") => void;
  isReverse: boolean;
}

/**
 * Radio group to select destination input mode
 */
export function DestinationModeSelector({
  mode,
  onChange,
  isReverse,
}: DestinationModeSelectorProps) {
  const label = isReverse
    ? "Como deseja informar o remetente?"
    : "Como deseja informar o destino?";

  const manualLabel = isReverse
    ? "Informar manualmente o remetente"
    : "Informar manualmente o CEP";

  const recipientLabel = isReverse
    ? "Selecionar remetente recorrente"
    : "Selecionar destinatário recorrente";

  return (
    <div>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 13, display: "block", marginBottom: 6 }}
      >
        {label}
      </Typography.Text>
      <Radio.Group
        value={mode}
        onChange={(e) => onChange(e.target.value as "manual" | "recipient")}
        size="small"
      >
        <Radio value="recipient">{recipientLabel}</Radio>
        <Radio value="manual">{manualLabel}</Radio>
      </Radio.Group>
    </div>
  );
}
