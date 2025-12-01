/**
 * SectionCard - Card padronizado para seções de página
 *
 * Uso:
 * - Seções com título: <SectionCard title="Meus Dados">...</SectionCard>
 * - Seções sem título: <SectionCard>...</SectionCard>
 * - Com ações extras: <SectionCard title="Lista" extra={<Button>Novo</Button>}>...</SectionCard>
 */
import { Card, Typography } from "antd";
import type { CardProps } from "antd";
import type { ReactNode } from "react";
import { spacing } from "@/lib/ui/theme";

const { Title } = Typography;

export interface SectionCardProps extends Omit<CardProps, "title"> {
  /** Título da seção (opcional) */
  title?: ReactNode;
  /** Descrição abaixo do título (opcional) */
  description?: ReactNode;
  /** Elemento extra no header (botões, links) */
  extra?: ReactNode;
  /** Padding interno do body */
  padding?: keyof typeof spacing;
  /** Variante visual */
  variant?: "outlined" | "borderless";
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  extra,
  padding = "xl",
  variant,
  children,
  styles,
  ...cardProps
}: SectionCardProps) {
  const paddingValue = spacing[padding];

  // Se tem título, usar estrutura com header customizado
  // Se não tem, apenas o card com children
  const hasHeader = title || extra;

  const bodyStyle = {
    padding: paddingValue,
    ...(styles?.body ?? {}),
  };

  if (!hasHeader) {
    return (
      <Card
        variant={variant}
        styles={{ ...styles, body: bodyStyle }}
        {...cardProps}
      >
        {children}
      </Card>
    );
  }

  return (
    <Card
      variant={variant}
      styles={{ ...styles, body: bodyStyle }}
      {...cardProps}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing.lg,
          gap: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <div>
          {title && (
            <Title
              level={5}
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {title}
            </Title>
          )}
          {description && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 13, marginTop: 4, display: "block" }}
            >
              {description}
            </Typography.Text>
          )}
        </div>
        {extra && <div>{extra}</div>}
      </div>
      {children}
    </Card>
  );
}

export default SectionCard;
