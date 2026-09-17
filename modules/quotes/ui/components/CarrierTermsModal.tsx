"use client";

import { useEffect, useState, startTransition } from "react";
import { LinkOutlined } from "@ant-design/icons";
import { ELCheckbox, ELSpace, ELTypography } from "@/shared/ui";
const Checkbox = ELCheckbox;
const Space = ELSpace;
const Typography = ELTypography;
import { ELModal } from "@/shared/ui/ELModal";
import { ELButton } from "@/shared/ui/ELButton";

type TermLink = {
  label: string;
  url: string;
};

type CarrierTermsConfig = {
  label: string;
  links: TermLink[];
};

const CARRIER_TERMS: Record<string, CarrierTermsConfig> = {
  loggi: {
    label: "Loggi",
    links: [{ label: "Termos de Uso Loggi", url: "https://share.google/8rOdTCm5w7IsxTYoN" }],
  },
  correios: {
    label: "Correios",
    links: [
      {
        label: "Política de Privacidade e Cookies",
        url: "https://www.correios.com.br/falecomoscorreios/politica-de-privacidade-e-cookies",
      },
      {
        label: "Indenizações",
        url: "https://www.correios.com.br/receber/encomenda/indenizacoes",
      },
    ],
  },
  "j-t-express": {
    label: "J&T Express",
    links: [{ label: "Regras de Negócio J&T Express", url: "/assets/termos-jt-express.pdf" }],
  },
};

const ENVIO_LEGAL_TERMS: TermLink = {
  label: "Termos de Uso Multienvio",
  url: "/assets/termos-envio-legal.pdf",
};

function deriveCarrierSlug(carrierName: string): string {
  return carrierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type CarrierTermsModalProps = {
  open: boolean;
  carrierName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function CarrierTermsModal({
  open,
  carrierName,
  onConfirm,
  onCancel,
}: CarrierTermsModalProps) {
  const [carrierAgreed, setCarrierAgreed] = useState(false);
  const [enviolegalAgreed, setEnviolegalAgreed] = useState(false);

  useEffect(() => {
    if (!open) {
      startTransition(() => {
        setCarrierAgreed(false);
        setEnviolegalAgreed(false);
      });
    }
  }, [open]);

  const slug = deriveCarrierSlug(carrierName);
  const carrierConfig = CARRIER_TERMS[slug];
  const canConfirm = (carrierConfig ? carrierAgreed : true) && enviolegalAgreed;

  return (
    <ELModal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={`Confirmar envio com ${carrierName || "transportadora"}`}
      size="sm"
    >
      <Space orientation="vertical" size={20} style={{ width: "100%" }}>
        {carrierConfig && (
          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
              Termos da transportadora
            </Typography.Text>
            <Space orientation="vertical" size={4} style={{ width: "100%", marginBottom: 12 }}>
              {carrierConfig.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                >
                  <LinkOutlined />
                  {link.label}
                </a>
              ))}
            </Space>
            <Checkbox
              checked={carrierAgreed}
              onChange={(e) => setCarrierAgreed(e.target.checked)}
            >
              Li e concordo com os termos da {carrierConfig.label}
            </Checkbox>
          </div>
        )}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Termos de Uso Multienvio
          </Typography.Text>
          <a
            href={ENVIO_LEGAL_TERMS.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 12 }}
          >
            <LinkOutlined />
            {ENVIO_LEGAL_TERMS.label}
          </a>
          <Checkbox
            checked={enviolegalAgreed}
            onChange={(e) => setEnviolegalAgreed(e.target.checked)}
          >
            Li e concordo com os Termos de Uso do Multienvio
          </Checkbox>
        </div>

        <ELButton
          variant="primary"
          block
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Confirmar e continuar
        </ELButton>
      </Space>
    </ELModal>
  );
}
