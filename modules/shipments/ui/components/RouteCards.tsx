import { ELFlowConnector, ELFlexAntd, ELSpace, ELTypography, useBreakpoint, useELTheme } from "@/shared/ui";
import { BankOutlined, EnvironmentOutlined } from "@ant-design/icons";
const Flex = ELFlexAntd;
const Space = ELSpace;
const Typography = ELTypography;
import type { ReactNode } from "react";
import {
  cardContainerStyles,
  cardHeaderStyles,
  cardBodyStyles,
  getCardAccentColor,
} from "./route.css";
import type { RouteCardVariant } from "./route.css";

type RouteCardHeader = {
  step: number;
  label: string;
  icon: "origin" | "destination";
};

type RouteCardsProps = {
  isReverse: boolean;
  originCard: ReactNode;
  destinationCard: ReactNode;
  originHeader?: RouteCardHeader;
  destinationHeader?: RouteCardHeader;
};

/**
 * RouteCards - Layout de fluxo Origem → Destino
 * Suporta inversão visual para Logística Reversa mantendo a lógica intacta.
 */
export function RouteCards({
  isReverse,
  originCard,
  destinationCard,
  originHeader = { step: 1, label: "Origem", icon: "origin" },
  destinationHeader = { step: 2, label: "Destino", icon: "destination" },
}: RouteCardsProps) {
  const { token } = useELTheme();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Inverte a ordem dos cards visualmente no modo reverso
  const cards = isReverse
    ? [destinationCard, originCard]
    : [originCard, destinationCard];

  // Headers também invertem
  const headers = isReverse
    ? [destinationHeader, originHeader]
    : [originHeader, destinationHeader];

  // A variante visual acompanha a posição após inversão
  const leftVariant: RouteCardVariant = isReverse ? "destination" : "origin";
  const rightVariant: RouteCardVariant = isReverse ? "origin" : "destination";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 0 : token.paddingMD,
        alignItems: "stretch",
        width: "100%",
      }}
    >
      <FlowCard variant={leftVariant} header={headers[0]}>{cards[0]}</FlowCard>

      <ELFlowConnector
        isReverse={isReverse}
        direction={isMobile ? "vertical" : "horizontal"}
      />

      <FlowCard variant={rightVariant} header={headers[1]}>{cards[1]}</FlowCard>
    </div>
  );
}

type FlowCardProps = {
  children: ReactNode;
  variant: RouteCardVariant;
  header?: RouteCardHeader;
};

/**
 * FlowCard - Card individual com header colorido (contendo título) e corpo neutro
 */
function FlowCard({ children, variant, header }: FlowCardProps) {
  const { token } = useELTheme();
  const accentColor = getCardAccentColor(variant);

  const IconComponent = header?.icon === "destination" ? EnvironmentOutlined : BankOutlined;

  return (
    <div style={cardContainerStyles(token, variant)}>
      {/* Header com ícone e título */}
      <div style={cardHeaderStyles(variant)}>
        {header && (
          <Flex align="center" gap={8}>
            <IconComponent
              style={{
                fontSize: 16,
                color: accentColor,
              }}
            />
            <Typography.Text strong style={{ fontSize: 14, color: accentColor }}>
              {header.step}) {header.label}
            </Typography.Text>
          </Flex>
        )}
      </div>
      {/* Corpo do card */}
      <div style={cardBodyStyles()}>
        <Space orientation="vertical" size={token.padding} style={{ width: "100%" }}>
          {children}
        </Space>
      </div>
    </div>
  );
}
