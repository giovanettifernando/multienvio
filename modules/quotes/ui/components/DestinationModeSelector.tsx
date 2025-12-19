"use client";

import { ELChoicePills } from '@/shared/ui';
import { UserOutlined, EditOutlined } from "@ant-design/icons";

interface DestinationModeSelectorProps {
  mode: "manual" | "recipient";
  onChange: (mode: "manual" | "recipient") => void;
  isReverse: boolean;
  disabled?: boolean;
}

/**
 * Seletor de modo de entrada do destino/remetente usando pills modernas.
 */
export function DestinationModeSelector({
  mode,
  onChange,
  isReverse,
  disabled,
}: DestinationModeSelectorProps) {
  const options = [
    {
      value: "recipient" as const,
      label: isReverse ? "Remetente recorrente" : "Destinatário recorrente",
      description: isReverse ? "Selecionar da lista" : "Selecionar da lista",
      icon: <UserOutlined />,
    },
    {
      value: "manual" as const,
      label: "Informar manualmente",
      description: "Digitar o CEP",
      icon: <EditOutlined />,
    },
  ];

  return (
    <ELChoicePills
      options={options}
      value={mode}
      onChange={onChange}
      disabled={disabled}
      size="small"
    />
  );
}
