import type { ReactNode } from "react";
import { ELSpace, useELTheme, ELBadge } from "@/shared/ui";
const Space = ELSpace;
const Badge = ELBadge;
import {
  RollbackOutlined,
  SwapRightOutlined,
} from "@ant-design/icons";

type RouteModeTagProps = {
  isReverse: boolean;
  children: ReactNode;
};

export function RouteModeTag({ isReverse, children }: RouteModeTagProps) {
  const { token } = useELTheme();

  const icon = isReverse ? (
    <RollbackOutlined style={{ fontSize: 16 }} />
  ) : (
    <SwapRightOutlined style={{ fontSize: 16 }} />
  );

  const text = isReverse
    ? "Logística Reversa (Destinatário → Empresa)"
    : "Envio → Destinatário";

  const ribbonColor = isReverse ? token.colorWarning : token.colorInfo;

  return (
    <Badge.Ribbon
      color={ribbonColor}
      text={
        <Space
          size={token.paddingXS}
          role="status"
          aria-live="polite"
          style={{
            fontWeight: 600,
            color: token.colorWhite,
            alignItems: "center",
          }}
        >
          {icon}
          <span>{text}</span>
        </Space>
      }
      placement="start"
    >
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          padding: token.paddingLG,
        }}
      >
        {children}
      </div>
    </Badge.Ribbon>
  );
}
