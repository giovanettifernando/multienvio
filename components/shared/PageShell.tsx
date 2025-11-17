/**
 * PageShell - Wrapper padrão para páginas com header e ações
 *
 * Comportamento:
 * - Faixa azul fixa no topo da área de conteúdo (sticky)
 * - Fundo azul (primary) com texto branco para destaque
 * - Sem subtítulos/descrições (removidos para simplicidade)
 * - A faixa permanece fixa; apenas o conteúdo abaixo rola
 * - Ocupa toda a largura do container de conteúdo
 */
import React from "react";
import { Flex, Typography, theme } from "antd";
import { spacing } from "@/lib/ui/theme";

interface PageShellProps {
  title?: string;
  /** @deprecated Subtítulos foram removidos do padrão. Use apenas o título. */
  description?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  gap?: keyof typeof spacing;
  style?: React.CSSProperties;
}

export function PageShell({
  title,
  description, // deprecated, mas mantido para compatibilidade
  extra,
  children,
  gap = "xl",
  style,
}: PageShellProps) {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={spacing[gap]} style={style}>
      {(title || extra) && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            backgroundColor: token.colorPrimary,
            padding: `${spacing.lg}px ${spacing.xl}px`,
            marginLeft: -spacing.xl,
            marginRight: -spacing.xl,
            marginBottom: spacing.lg,
          }}
        >
          <Flex justify="space-between" align="center" wrap="wrap" gap={spacing.md}>
            {title && (
              <Typography.Title
                level={3}
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#ffffff',
                }}
              >
                {title}
              </Typography.Title>
            )}
            {extra && <div style={{ color: '#ffffff' }}>{extra}</div>}
          </Flex>
        </div>
      )}
      {children}
    </Flex>
  );
}
