import { ArrowDownOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Grid, Space, Typography, theme } from "antd";
import type { ReactNode } from "react";

export type RouteSummary = {
  primary: string;
  secondary?: string | null;
};

type RouteSummaryBarProps = {
  origin: RouteSummary;
  destination: RouteSummary;
  isReverse: boolean;
  extra?: ReactNode;
};

export function RouteSummaryBar({
  origin,
  destination,
  isReverse,
  extra,
}: RouteSummaryBarProps) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const arrowIcon = isMobile ? (
    <ArrowDownOutlined />
  ) : (
    <ArrowRightOutlined />
  );

  const arrowTransform = isReverse
    ? isMobile
      ? "rotate(180deg)"
      : "rotate(180deg)"
    : "rotate(0deg)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: token.padding,
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: "space-between",
        background: token.colorBgElevated,
        padding: token.padding,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowTertiary,
        position: "sticky",
        top: 0,
        zIndex: 9,
      }}
    >
      <Space
        direction={isMobile ? "vertical" : "horizontal"}
        size={token.padding}
        align={isMobile ? "start" : "center"}
        style={{ flexWrap: "wrap", flex: 1, minWidth: 0 }}
        role="status"
        aria-live="polite"
      >
        <SummaryPart
          label="Origem"
          primary={origin.primary}
          secondary={origin.secondary}
        />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 240ms ease",
            transform: arrowTransform,
            color: isReverse ? token.colorWarning : token.colorInfo,
          }}
        >
          {arrowIcon}
        </span>
        <SummaryPart
          label="Destino"
          primary={destination.primary}
          secondary={destination.secondary}
          align="end"
        />
      </Space>

      {extra ? <div>{extra}</div> : null}
    </div>
  );
}

type SummaryPartProps = RouteSummary & {
  label: string;
  align?: "start" | "end";
};

function SummaryPart({
  label,
  primary,
  secondary,
  align = "start",
}: SummaryPartProps) {
  const { token } = theme.useToken();

  return (
    <Space
      direction="vertical"
      size={4}
      style={{ minWidth: 0, textAlign: align }}
    >
      <Typography.Text
        style={{
          fontSize: token.fontSizeSM,
          fontWeight: 600,
          color: token.colorTextSecondary,
        }}
      >
        {label}:
      </Typography.Text>
      <Typography.Text
        style={{
          fontWeight: 600,
          color: token.colorText,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {primary}
      </Typography.Text>
      {secondary ? (
        <Typography.Text
          type="secondary"
          style={{
            maxWidth: 300,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {secondary}
        </Typography.Text>
      ) : null}
    </Space>
  );
}
