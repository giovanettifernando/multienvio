import { BankOutlined } from "@ant-design/icons";
import { Space, Tag, Typography, theme } from "antd";
import type { ReactNode } from "react";

type OriginInfo = {
  cidade?: string;
  uf?: string;
  label?: string;
  isDefault?: boolean;
} | null;

type OriginCardProps = {
  title: string;
  subtitle?: string;
  info: OriginInfo;
  children: ReactNode;
};

export function OriginCard({
  title,
  subtitle,
  info,
  children,
}: OriginCardProps) {
  const { token } = theme.useToken();

  return (
    <div>
      <Space
        direction="horizontal"
        align="start"
        size={token.paddingSM}
        style={{ marginBottom: token.padding }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: token.borderRadiusLG,
            background: token.colorInfoBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: token.colorInfo,
            fontSize: token.fontSizeLG,
          }}
        >
          <BankOutlined />
        </div>

        <Space direction="vertical" size={4}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          ) : null}
        </Space>
      </Space>

      {children}
    </div>
  );
}
