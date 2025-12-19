"use client";

import { ELCollapse, ELSpace, ELTypography, ELTag } from '@/shared/ui';
const Collapse = ELCollapse;
const Space = ELSpace;
const Typography = ELTypography;
const Tag = ELTag;
import { useFormContext } from "react-hook-form";
import type { FinalizeFormValues } from '@/shared/types/quoteFinalize';
import { VolumeDeclarationItems } from "@/modules/quotes/ui/components/VolumeDeclarationItems";

export function VolumeDocuments() {
  const { watch } = useFormContext<FinalizeFormValues>();
  const volumeDeclarations = watch("document.volumeDeclarations") ?? [];

  if (volumeDeclarations.length === 0) {
    return (
      <Typography.Text type="secondary">
        Nenhum volume cadastrado na cotação.
      </Typography.Text>
    );
  }

  const items = volumeDeclarations.map((volDecl, index) => {
    const total = volDecl.items?.reduce((acc, item) => {
      const unit = Number(item.valorUnitario) || 0;
      const quantity = Number(item.quantidade) || 0;
      return acc + unit * quantity;
    }, 0) ?? 0;

    const currency = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });

    return {
      key: index.toString(),
      label: (
        <Space>
          <span>Volume {index + 1}</span>
          {total > 0 && (
            <Tag color="blue">Total: {currency.format(total)}</Tag>
          )}
        </Space>
      ),
      children: <VolumeDeclarationItems volumeIndex={index} />,
    };
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Paragraph type="secondary">
        Preencha a declaração de conteúdo para cada volume do envio.
      </Typography.Paragraph>
      <Collapse
        items={items}
        defaultActiveKey={["0"]}
        accordion={false}
      />
    </Space>
  );
}
