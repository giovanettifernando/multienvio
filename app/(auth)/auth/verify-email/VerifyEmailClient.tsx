"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircleOutlined, CloseCircleOutlined, MailOutlined } from "@ant-design/icons";
import Link from "next/link";
import { ELResult, ELSpin, ELAlert, ELButton, FormCard } from '@/shared/ui';
const Result = ELResult;
const Spin = ELSpin;

type VerificationState = "validating" | "success" | "error" | "already_verified";
type VerificationResult = {
  state: VerificationState;
  message: string;
  email: string;
  errorCode: string;
};

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const hasFetched = useRef(false);

  // Estado inicial baseado na presença do token
  const initialState = useMemo((): VerificationResult => {
    if (!token) {
      return {
        state: "error",
        message: "Token de verificação não fornecido. Verifique o link no email.",
        email: "",
        errorCode: "MISSING_TOKEN"
      };
    }
    return { state: "validating", message: "", email: "", errorCode: "" };
  }, [token]);

  const [result, setResult] = useState<VerificationResult>(initialState);

  // Chamar endpoint de verificação
  useEffect(() => {
    if (!token || hasFetched.current) return;

    const verifyEmail = async () => {
      hasFetched.current = true;
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (response.ok) {
          if (data.code === "ALREADY_VERIFIED") {
            setResult({ state: "already_verified", message: data.message, email: "", errorCode: "" });
          } else {
            setResult({ state: "success", message: data.message, email: data.email || "", errorCode: "" });
          }
        } else {
          setResult({
            state: "error",
            message: data.message || "Erro ao verificar email",
            email: "",
            errorCode: data.code || "UNKNOWN_ERROR"
          });
        }
      } catch (error) {
        console.error("[VERIFY_EMAIL] Error:", error);
        setResult({
          state: "error",
          message: "Erro ao conectar com o servidor. Tente novamente.",
          email: "",
          errorCode: "NETWORK_ERROR"
        });
      }
    };

    verifyEmail();
  }, [token]);

  const { state, message, email, errorCode } = result;

  const handleResendVerification = () => {
    router.push(`/auth/resend-verification?email=${encodeURIComponent(email)}`);
  };

  if (state === "validating") {
    return (
      <FormCard titulo="Verificando email" subtitulo="Aguarde enquanto verificamos seu email...">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin size="large" />
          <p style={{ marginTop: 24, color: "#666" }}>Processando verificação...</p>
        </div>
      </FormCard>
    );
  }

  if (state === "success") {
    return (
      <FormCard
        titulo="Email verificado com sucesso!"
        subtitulo="Sua conta foi ativada. Você já pode fazer login."
      >
        <Result
          status="success"
          icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
          title="Email verificado!"
          subTitle={message}
          extra={[
            <Link key="login" href="/auth/login" passHref>
              <ELButton variant="primary" size="large">
                Fazer Login
              </ELButton>
            </Link>,
          ]}
        />
      </FormCard>
    );
  }

  if (state === "already_verified") {
    return (
      <FormCard titulo="Email já verificado" subtitulo="Você já pode fazer login na sua conta.">
        <Result
          status="info"
          icon={<CheckCircleOutlined style={{ color: "#1890ff" }} />}
          title="Email já verificado"
          subTitle={message}
          extra={[
            <Link key="login" href="/auth/login" passHref>
              <ELButton variant="primary" size="large">
                Fazer Login
              </ELButton>
            </Link>,
          ]}
        />
      </FormCard>
    );
  }

  // Error state
  return (
    <FormCard
      titulo="Erro na verificação"
      subtitulo="Não foi possível verificar seu email. Veja os detalhes abaixo."
    >
      <Result
        status="error"
        icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
        title="Verificação falhou"
        subTitle={message}
        extra={[
          <Link key="login" href="/auth/login" passHref>
            <ELButton size="large">Ir para Login</ELButton>
          </Link>,
          errorCode === "INVALID_TOKEN" && (
            <ELButton
              key="resend"
              variant="primary"
              size="large"
              icon={<MailOutlined />}
              onClick={handleResendVerification}
              disabled={!email}
            >
              Reenviar Email de Verificação
            </ELButton>
          ),
        ].filter(Boolean)}
      />

      {errorCode === "MISSING_TOKEN" && (
        <ELAlert
          message="Token não fornecido"
          description="Verifique se você clicou no link correto enviado por email."
          variant="warning"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}

      {errorCode === "INVALID_TOKEN" && (
        <ELAlert
          message="Token inválido ou expirado"
          description="O link de verificação pode ter expirado. Clique no botão acima para solicitar um novo email."
          variant="danger"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}
    </FormCard>
  );
}

export default function VerifyEmailClient() {
  return (
    <Suspense fallback={
      <FormCard titulo="Verificando email...">
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      </FormCard>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
