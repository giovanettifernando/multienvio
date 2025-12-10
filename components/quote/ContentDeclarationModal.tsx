"use client";

import { useEffect, useState } from "react";
import { FileTextOutlined, SafetyOutlined } from "@ant-design/icons";
import { Checkbox, Modal, Space, Typography } from "antd";
import { ELButton } from "@/components/ui/ELButton";

type ContentDeclarationModalProps = {
  open: boolean;
  carrierName: string;
  onAgree: (options: { remember: boolean }) => void;
  onSendNfe: (options: { remember: boolean }) => void;
  onClose: () => void;
};

export function ContentDeclarationModal({
  open,
  carrierName,
  onAgree,
  onSendNfe,
  onClose,
}: ContentDeclarationModalProps) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!open) {
      setRemember(false);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Declaração de conteúdo"
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Paragraph>
          <SafetyOutlined style={{ marginRight: 8 }} />
          Ao seguir com a declaração de conteúdo você afirma que o envio não possui
          finalidade comercial, que a indenização será limitada ao valor declarado
          e que não há cobertura para avarias.
        </Typography.Paragraph>

        <Checkbox
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        >
          Lembrar da minha resposta e não exibir novamente.
        </Checkbox>

        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <ELButton
            variant="primary"
            block
            onClick={() => onAgree({ remember })}
          >
            CONCORDAR
          </ELButton>
          <ELButton
            variant="default"
            block
            icon={<FileTextOutlined />}
            onClick={() => onSendNfe({ remember })}
          >
            Enviar com nota fiscal
          </ELButton>
        </Space>
      </Space>
    </Modal>
  );
}
