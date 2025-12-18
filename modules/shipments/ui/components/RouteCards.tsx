import { ArrowDownOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Grid, Space, theme } from "antd";
import type { ReactNode } from "react";
import { cardContainerStyles, connectorStyles } from "./route.css";
import type { RouteCardVariant } from "./route.css";

type RouteCardsProps = {
  isReverse: boolean;
  originCard: ReactNode;
  destinationCard: ReactNode;
};

export function RouteCards({
  isReverse,
  originCard,
  destinationCard,
}: RouteCardsProps) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const cards = isReverse
    ? [destinationCard, originCard]
    : [originCard, destinationCard];

  const ArrowIcon = isMobile ? ArrowDownOutlined : ArrowRightOutlined;
  const connectorTransform = isReverse
    ? isMobile
      ? "rotate(180deg)"
      : "rotate(180deg)"
    : "rotate(0deg)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: token.paddingLG,
        alignItems: isMobile ? "stretch" : "center",
        width: "100%",
      }}
    >
      <CardContainer variant={isReverse ? "destination" : "origin"}>
        {cards[0]}
      </CardContainer>

      <span
        style={{
          ...connectorStyles(token),
          transform: connectorTransform,
          color: isReverse ? token.colorError : token.colorPrimary,
          borderColor: isReverse ? token.colorErrorBorder : token.colorPrimaryBorder,
          background: isReverse ? token.colorErrorBg : token.colorPrimaryBg,
        }}
        aria-hidden
      >
        <ArrowIcon />
      </span>

      <CardContainer variant={isReverse ? "origin" : "destination"}>
        {cards[1]}
      </CardContainer>
    </div>
  );
}

type CardContainerProps = {
  children: ReactNode;
  variant: RouteCardVariant;
};

function CardContainer({ children, variant }: CardContainerProps) {
  const { token } = theme.useToken();
  return (
    <div style={cardContainerStyles(token, variant)}>
      <Space
        orientation="vertical"
        size={token.padding}
        style={{ width: "100%" }}
      >
        {children}
      </Space>
    </div>
  );
}
