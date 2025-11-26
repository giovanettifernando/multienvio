import { Suspense } from "react";
import { Spin } from "antd";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
          <Spin size="large" tip="Carregando...">
            <div style={{ minHeight: 100 }} />
          </Spin>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
