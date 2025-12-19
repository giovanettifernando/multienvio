"use client";

import { ELSelect } from "@/shared/ui";
const Select = ELSelect;

type Props = {
  onSelect: (message: string) => void;
};

const REPLIES = [
  {
    label: "Solicitar nota fiscal",
    value: "Por favor, nos envie a nota fiscal do pedido para prosseguirmos.",
  },
  {
    label: "Em contato com transportadora",
    value: "Estamos verificando com a transportadora e retornaremos em breve.",
  },
  {
    label: "Coleta reprogramada",
    value: "Reprogramamos a coleta para o próximo dia útil. Confirme disponibilidade, por favor.",
  },
];

export function CannedReplySelect({ onSelect }: Props) {
  return (
    <Select
      allowClear
      placeholder="Respostas rápidas"
      options={REPLIES}
      style={{ minWidth: 220 }}
      aria-label="Selecionar resposta rápida"
      onChange={(value) => {
        if (value && typeof value === 'string') {
          onSelect(value);
        }
      }}
    />
  );
}
