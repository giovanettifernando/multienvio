import type { CSSProperties } from "react";
import type { GlobalToken } from "@/shared/ui/antd-types";

export type RouteCardVariant = "origin" | "destination";

/**
 * Paleta de cores para os cards - Design moderno e sutil
 * - Cards têm fundo neutro (surface)
 * - Diferenciação por accent strip no header
 */
const cardPalette = {
  origin: {
    accent: "#0B4EA3", // Azul primário
    accentLight: "rgba(11, 78, 163, 0.08)",
    border: "#E4E7EC",
  },
  destination: {
    accent: "#059669", // Verde
    accentLight: "rgba(5, 150, 105, 0.08)",
    border: "#E4E7EC",
  },
};

export const getCardAccentColor = (variant: RouteCardVariant): string => {
  return cardPalette[variant].accent;
};

export const getCardAccentLightColor = (variant: RouteCardVariant): string => {
  return cardPalette[variant].accentLight;
};

/**
 * Estilos do container do card - Design neutro com accent strip
 */
export const cardContainerStyles = (
  token: GlobalToken,
  variant: RouteCardVariant,
): CSSProperties => {
  const palette = cardPalette[variant];
  return {
    flex: 1,
    minWidth: 0,
    borderRadius: token.borderRadiusLG,
    padding: 0,
    border: `1px solid ${palette.border}`,
    background: token.colorBgContainer,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
    overflow: "hidden",
    transition: "border-color 200ms ease, box-shadow 200ms ease",
  };
};

/**
 * Estilos do header do card com accent strip
 */
export const cardHeaderStyles = (
  variant: RouteCardVariant,
): CSSProperties => {
  const palette = cardPalette[variant];
  return {
    padding: "8px 12px",
    background: palette.accentLight,
    borderBottom: `2px solid ${palette.accent}`,
  };
};

/**
 * Estilos do body do card
 */
export const cardBodyStyles = (): CSSProperties => ({
  padding: 16,
});

/**
 * @deprecated Use ELFlowConnector ao invés
 * Estilos do conector (seta) entre os cards
 */
export const connectorStyles = (token: GlobalToken): CSSProperties => ({
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: token.colorBgLayout,
  border: `1px solid ${token.colorBorderSecondary}`,
  color: token.colorTextTertiary,
  fontSize: 11,
  flexShrink: 0,
  transition: "transform 240ms ease, color 200ms ease, background 200ms ease",
});
