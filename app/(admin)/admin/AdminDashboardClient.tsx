"use client";

import { PageShell } from '@/shared/ui/PageShell';
import { Typography } from "antd";

export default function AdminDashboardClient() {
  return (
    <PageShell title="Visão geral" gap="md">
      <Typography.Text type="secondary">
        Dashboard administrativo em desenvolvimento
      </Typography.Text>
    </PageShell>
  );
}
