import { EnvironmentOutlined } from "@ant-design/icons";
import { Space, Typography, theme } from "antd";
import type { ReactNode } from "react";

type DestinationInfo = {
  cidade?: string;
  uf?: string;
  label?: string | null;
} | null;

type DestinationCardProps = {
  title: string;
  subtitle?: string;
  info: DestinationInfo;
  modeSelector: ReactNode;
  children: ReactNode;
  tag?: ReactNode;
};

export function DestinationCard({
  title,
  subtitle,
  info,
  modeSelector,
  children,
  tag,
}: DestinationCardProps) {
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
            background: token.colorSuccessBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: token.colorSuccess,
            fontSize: token.fontSizeLG,
          }}
        >
          <EnvironmentOutlined />
        </div>

        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          ) : null}
          {info?.cidade && info?.uf ? (
            <Typography.Text type="secondary">
              {info.cidade} / {info.uf}
              {info.label ? ` · ${info.label}` : ""}
            </Typography.Text>
          ) : null}
          {tag ? tag : null}
        </Space>
      </Space>

      <div style={{ marginBottom: token.padding }}>{modeSelector}</div>
      {children}
    </div>
  );
}
