"use client";

import Image from "next/image";
import Link from "next/link";
import { Typography } from "antd";

const { Text } = Typography;

export function AppLogo() {
  return (
    <Link
      href="/"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
      aria-label="Ir para o painel inicial do Envio Legal"
    >
      <Image
        src="/logo-enviolegal.svg"
        alt="Envio Legal"
        width={132}
        height={32}
        priority
      />
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.85)",
          fontWeight: 500,
          fontSize: 14,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        painel
      </Text>
    </Link>
  );
}
