"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Result, Spin, Typography } from "antd";
import { MailOutlined, CheckCircleOutlined } from "@ant-design/icons";
import Link from "next/link";
import { FormCard } from "@/components/ui/FormCard";

const { Paragraph, Text } = Typography;

function ConfirmacaoContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const emailSent = searchParams.get("emailSent") === "true";

  return (
    <FormCard
      titulo="Cadastro realizado!"
      subtitulo="Sua conta foi criada com sucesso."
    >
      <Result
        icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
        title="Verifique seu email"
        subTitle={
          emailSent
            ? `Enviamos um link de verificação para ${email || "seu email"}.`
            : "Complete a verificação do seu email para ativar sua conta."
        }
        extra={[
          <Link key="login" href="/auth/login" passHref>
            <Button type="primary" size="large">
              Ir para Login
            </Button>
          </Link>,
        ]}
      />

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <MailOutlined style={{ fontSize: 48, color: "#1890ff", marginBottom: 16 }} />

        <Paragraph type="secondary">
          Clique no link enviado para o email <Text strong>{email}</Text> para ativar sua conta.
        </Paragraph>

        <Paragraph type="secondary" style={{ marginTop: 16 }}>
          Caso o email demore, verifique sua pasta de spam ou lixo eletrônico.
        </Paragraph>

        {!emailSent && (
          <Paragraph type="warning" style={{ marginTop: 16 }}>
            Se não receber o email em alguns minutos, tente fazer login para reenviar o email de verificação.
          </Paragraph>
        )}
      </div>
    </FormCard>
  );
}

export default function ConfirmacaoClient() {
  return (
    <Suspense
      fallback={
        <FormCard titulo="Carregando...">
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin size="large" />
          </div>
        </FormCard>
      }
    >
      <ConfirmacaoContent />
    </Suspense>
  );
}
