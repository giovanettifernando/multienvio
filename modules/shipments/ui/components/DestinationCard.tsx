import { EnvironmentOutlined } from "@ant-design/icons";
import { ELFlexAntd, ELTypography } from "@/shared/ui";
const Flex = ELFlexAntd;
const Typography = ELTypography;
import type { ReactNode } from "react";
import { getCardAccentColor, type RouteCardVariant } from "./route.css";

type DestinationCardProps = {
  title: string;
  subtitle?: string;
  /** @deprecated Use subtitle instead */
  info?: {
    cidade?: string;
    uf?: string;
    label?: string | null;
  };
  modeSelector: ReactNode;
  /** @deprecated No longer displayed */
  tag?: ReactNode;
  /** Variante visual do card (determina a cor) */
  variant?: RouteCardVariant;
  children: ReactNode;
};

export function DestinationCard({
  title,
  subtitle,
  modeSelector,
  variant = "destination",
  children,
}: DestinationCardProps) {
  const accentColor = getCardAccentColor(variant);

  return (
    <div>
      <Flex
        align="center"
        gap={8}
        style={{ marginBottom: 12 }}
      >
        <EnvironmentOutlined
          style={{
            fontSize: 18,
            color: accentColor,
          }}
        />
        <Typography.Text strong style={{ fontSize: 15, color: accentColor }}>
          {title}
        </Typography.Text>
      </Flex>

      {subtitle && (
        <Typography.Text
          type="secondary"
          style={{ display: "block", marginBottom: 12, fontSize: 13 }}
        >
          {subtitle}
        </Typography.Text>
      )}

      <div style={{ marginBottom: 12 }}>{modeSelector}</div>
      {children}
    </div>
  );
}
