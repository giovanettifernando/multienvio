import { ELTypography } from "@/shared/ui";
const Typography = ELTypography;
import type { ReactNode } from "react";
import type { RouteCardVariant } from "./route.css";

type DestinationCardProps = {
  /** @deprecated Título agora é renderizado no header do FlowCard */
  title?: string;
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
  /** @deprecated Variante visual agora é controlada pelo RouteCards */
  variant?: RouteCardVariant;
  children: ReactNode;
};

/**
 * DestinationCard - Conteúdo do card de destino (sem título, que está no header do FlowCard)
 */
export function DestinationCard({
  subtitle,
  modeSelector,
  children,
}: DestinationCardProps) {
  return (
    <div>
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
