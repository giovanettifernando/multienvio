"use client";

import { Card, Space, Typography } from "antd";

const links = [
  { label: "Central de ajuda", href: "/ajuda" },
  { label: "Tabelas e prazos", href: "/docs/tabelas" },
  { label: "Política de envios", href: "/docs/politica-envios" },
  { label: "Status da plataforma", href: "/status" },
];

export function DashboardFooterLinks() {
  return (
    <Card variant="outlined">
      <Space wrap size={24}>
        {links.map((link) => (
          <Typography.Link key={link.href} href={link.href}>
            {link.label}
          </Typography.Link>
        ))}
      </Space>
    </Card>
  );
}
