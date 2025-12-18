"use client";

import type { ReactNode } from "react";
import { Alert, Space, Typography } from "antd";

type EmailPreviewProps = {
  previewUrl?: string | null;
  message?: ReactNode;
};

export function EmailPreview({
  previewUrl,
  message,
}: EmailPreviewProps) {
  if (
    process.env.NODE_ENV === "production" ||
    !previewUrl
  ) {
    return null;
  }

  return (
    <Alert
      type="info"
      showIcon
      message={
        <Space orientation="vertical" size={4}>
          <Typography.Text strong>
            Pré-visualização (dev)
          </Typography.Text>
          {message ? <div>{message}</div> : null}
          <Typography.Link href={previewUrl}>
            Abrir link de redefinição
          </Typography.Link>
        </Space>
      }
    />
  );
}
