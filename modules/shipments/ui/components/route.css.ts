import type { CSSProperties } from "react";
import type { GlobalToken } from "@/shared/ui/antd-types";

export type RouteCardVariant = "origin" | "destination";

// Paleta de cores customizada para os cards
const cardPalette = {
  origin: {
    bg: "rgba(15, 42, 95, 0.06)",
    border: "rgba(15, 42, 95, 0.18)",
    accent: "#0F2A5F",
  },
  destination: {
    bg: "#16A34A14",
    border: "rgba(22, 163, 74, 0.20)",
    accent: "#166534",
  },
};

export const getCardAccentColor = (variant: RouteCardVariant): string => {
  return cardPalette[variant].accent;
};

export const cardContainerStyles = (
  token: GlobalToken,
  variant: RouteCardVariant,
): CSSProperties => {
  const palette = cardPalette[variant];
  return {
    flex: 1,
    minWidth: 0,
    borderRadius: token.borderRadiusLG,
    padding: 16,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
    transition:
      "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
  };
};

export const connectorStyles = (token: GlobalToken): CSSProperties => ({
  width: 32,
  height: 32,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: token.colorBgContainer,
  border: `1px solid ${token.colorBorderSecondary}`,
  color: token.colorTextTertiary,
  fontSize: 14,
  flexShrink: 0,
  transition: "transform 240ms ease, color 200ms ease, background 200ms ease",
});
