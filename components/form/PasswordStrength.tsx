"use client";

import { useMemo } from "react";
import { Flex, Progress, Space, Typography } from "antd";

type PasswordStrengthProps = {
  value: string;
};

const requisitos = [
  {
    label: "Mínimo 8 caracteres",
    test: (senha: string) => senha.length >= 8,
  },
  {
    label: "Letra maiúscula",
    test: (senha: string) => /[A-Z]/.test(senha),
  },
  {
    label: "Letra minúscula",
    test: (senha: string) => /[a-z]/.test(senha),
  },
  {
    label: "Número",
    test: (senha: string) => /\d/.test(senha),
  },
];

function getStrengthColor(score: number): string {
  if (score <= 25) return "#d64545";
  if (score <= 50) return "#ff9800";
  if (score <= 75) return "#fabe0f";
  return "#2c9b5c";
}

export function PasswordStrength({ value }: PasswordStrengthProps) {
  const { score, atendidos } = useMemo(() => {
    const atendidos = requisitos.filter((item) => item.test(value));
    const score = (atendidos.length / requisitos.length) * 100;
    return { score, atendidos };
  }, [value]);

  return (
    <Flex vertical gap={8} role="status" aria-live="polite">
      <Progress
        percent={Math.round(score)}
        showInfo={false}
        size="small"
        strokeColor={getStrengthColor(score)}
        trailColor="#edf1f8"
      />
      <Space direction="vertical" size={0}>
        <Typography.Text strong>Sua senha deve conter:</Typography.Text>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {requisitos.map((item) => {
            const cumpriu = atendidos.includes(item);
            return (
              <li
                key={item.label}
                style={{
                  color: cumpriu ? "#2c9b5c" : "rgba(0,0,0,0.65)",
                  fontSize: 12,
                  listStyleType: "disc",
                }}
              >
                {item.label}
              </li>
            );
          })}
        </ul>
      </Space>
    </Flex>
  );
}
