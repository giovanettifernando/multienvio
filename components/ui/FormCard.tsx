"use client";

import type { PropsWithChildren, ReactNode } from "react";
import { Card, Flex, Typography } from "antd";

type FormCardProps = PropsWithChildren<{
  titulo: string;
  subtitulo?: string;
  footer?: ReactNode;
}>;

export function FormCard({
  titulo,
  subtitulo,
  footer,
  children,
}: FormCardProps) {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: "100vh",
        padding: "48px 16px",
        background:
          "linear-gradient(180deg, rgba(11,59,115,0.06) 0%, rgba(11,59,115,0.12) 100%)",
      }}
    >
      <Card
      style={{
        width: "100%",
        maxWidth: 440,
        boxShadow: "0 24px 48px -32px rgba(11,59,115,0.4)",
        borderRadius: 16,
      }}
      variant="borderless"
    >
        <Flex vertical gap={24}>
          <Flex vertical gap={8}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {titulo}
            </Typography.Title>
            {subtitulo ? (
              <Typography.Paragraph style={{ margin: 0 }} type="secondary">
                {subtitulo}
              </Typography.Paragraph>
            ) : null}
          </Flex>
          {children}
          {footer ? <div>{footer}</div> : null}
        </Flex>
      </Card>
    </Flex>
  );
}
