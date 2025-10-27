import type { CSSProperties } from "react";
import type { GlobalToken } from "antd/es/theme/interface";

export type RouteCardVariant = "origin" | "destination";

export const cardContainerStyles = (
  token: GlobalToken,
  variant: RouteCardVariant,
): CSSProperties => {
  const palette =
    variant === "origin"
      ? {
          border: token.colorInfoBorder,
          bg: token.colorInfoBg,
        }
      : {
          border: token.colorSuccessBorder,
          bg: token.colorSuccessBg,
        };

  return {
    flex: 1,
    minWidth: 0,
    borderRadius: token.borderRadiusLG,
    padding: token.paddingLG,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    boxShadow: token.boxShadowTertiary,
    transition:
      "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
  };
};

export const connectorStyles = (token: GlobalToken): CSSProperties => ({
  width: 40,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: token.borderRadiusLG,
  background: token.colorBgElevated,
  boxShadow: token.boxShadowSecondary,
  color: token.colorTextSecondary,
  transition: "transform 240ms ease, color 200ms ease, background 200ms ease",
});
