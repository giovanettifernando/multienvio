"use client";

import dynamic from "next/dynamic";
import { Spin } from "antd";
import { FormCard } from '@/shared/ui/FormCard';

const ConfirmacaoClient = dynamic(() => import("./ConfirmacaoClient"), {
  ssr: false,
  loading: () => (
    <FormCard titulo="Carregando...">
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <Spin size="large" />
      </div>
    </FormCard>
  ),
});

export default function ClientWrapper() {
  return <ConfirmacaoClient />;
}
