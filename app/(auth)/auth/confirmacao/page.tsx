"use client";

import Link from "next/link";
import { Button, Flex, Typography } from "antd";
import { FormCard } from "@/components/ui/FormCard";

export default function ConfirmacaoPage() {
  return (
    <FormCard
      titulo="Confirme sua conta"
      subtitulo="Enviamos um e-mail com o link de ativação. Pode levar alguns minutos."
      footer={
        <Typography.Paragraph style={{ margin: 0 }} type="secondary">
          Não recebeu? <Link href="/auth/cadastro">Tente novamente</Link>
        </Typography.Paragraph>
      }
    >
      <Flex vertical gap={16}>
        <Typography.Paragraph style={{ margin: 0 }}>
          Abra seu e-mail e clique em “Confirmar conta” para começar a
          usar o Envio Legal. Se não encontrar, verifique sua caixa de
          spam ou promoções.
        </Typography.Paragraph>
        <Button
          type="primary"
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          block
        >
          Abrir e-mail
        </Button>
      </Flex>
    </FormCard>
  );
}
