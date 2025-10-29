"use client";

import React, { useMemo } from "react";
import { Alert, Button, Space } from "antd";
import { useRouter } from "next/navigation";
import { useProfile, useCards } from "@/hooks/useAccount";
import { useAddressStore } from "@/lib/state/addresses";

export default function ProfileNudges() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const addresses = useAddressStore((s) => s.items);
  const { data: cards } = useCards();

  const needsPF = useMemo(() => {
    if (!profile) return true;
    return (
      !profile.fullName?.trim() ||
      !profile.cpf?.trim() ||
      !profile.email?.trim() ||
      !profile.phone?.trim()
    );
  }, [profile]);

  const needsAddress = useMemo(() => (addresses?.length ?? 0) === 0, [addresses]);
  const needsCard = useMemo(() => (cards?.length ?? 0) === 0, [cards]);

  if (!needsPF && !needsAddress && !needsCard) {
    return null;
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {needsPF ? (
        <Alert
          type="info"
          showIcon
          message="Complete seus dados pessoais"
          description={
            <Space wrap>
              Alguns campos essenciais do seu perfil ainda não foram preenchidos.
              <Button
                size="small"
                type="link"
                onClick={() => router.push("/minha-conta#personal")}
              >
                Ir para Dados Pessoais
              </Button>
            </Space>
          }
        />
      ) : null}
      {needsAddress ? (
        <Alert
          type="warning"
          showIcon
          message="Adicione um endereço"
          description={
            <Space wrap>
              Endereços ajudam a acelerar cotações e finalizações.
              <Button
                size="small"
                type="link"
                onClick={() => router.push("/minha-conta#addresses")}
              >
                Cadastrar endereço
              </Button>
            </Space>
          }
        />
      ) : null}
      {needsCard ? (
        <Alert
          type="warning"
          showIcon
          message="Cadastre um cartão (opcional)"
          description={
            <Space wrap>
              Você poderá pagar recargas com mais agilidade.
              <Button
                size="small"
                type="link"
                onClick={() => router.push("/minha-conta#cards")}
              >
                Cadastrar cartão
              </Button>
            </Space>
          }
        />
      ) : null}
    </Space>
  );
}
