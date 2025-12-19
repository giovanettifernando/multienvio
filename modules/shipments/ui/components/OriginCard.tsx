import { ELTypography } from "@/shared/ui";
const Typography = ELTypography;
import type { ReactNode } from "react";
import type { RouteCardVariant } from "./route.css";

type OriginCardProps = {
  /** @deprecated Título agora é renderizado no header do FlowCard */
  title?: string;
  subtitle?: string;
  /** @deprecated Use subtitle instead */
  info?: {
    cidade?: string;
    uf?: string;
    label?: string;
    cep?: string;
    isDefault?: boolean;
  } | null;
  /** @deprecated Variante visual agora é controlada pelo RouteCards */
  variant?: RouteCardVariant;
  children: ReactNode;
};

/**
 * OriginCard - Conteúdo do card de origem (sem título, que está no header do FlowCard)
 */
export function OriginCard({
  subtitle,
  children,
}: OriginCardProps) {
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

      {children}
    </div>
  );
}
