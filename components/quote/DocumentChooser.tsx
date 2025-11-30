"use client";

import { Card, Tabs, Typography } from "antd";
import { useFormContext } from "react-hook-form";
import type { DocumentType } from "@/types/quote";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import { NFeGridPerPackage } from "@/components/quote/NFeGridPerPackage";
import { DeclarationItems } from "@/components/quote/DeclarationItems";
import { VolumeDocuments } from "@/components/quote/VolumeDocuments";

export function DocumentChooser() {
  const { watch, setValue } = useFormContext<FinalizeFormValues>();
  const activeKey = watch("document.type") ?? "DECLARACAO";
  const volumeDeclarations = watch("document.volumeDeclarations");

  const handleChange = (key: string) => {
    setValue("document.type", key as DocumentType, { shouldDirty: true });
  };

  // Usar VolumeDocuments se houver múltiplos volumes com declarações
  const useVolumeDeclarations = volumeDeclarations && volumeDeclarations.length > 0;

  return (
    <Card>
      <Typography.Title level={5}>Qual documento usar?</Typography.Title>
      <Typography.Paragraph type="secondary">
        {useVolumeDeclarations
          ? "Preencha o documento para cada volume do envio."
          : "Informe se você enviará com Nota Fiscal modelo 55 ou Declaração de conteúdo."}
      </Typography.Paragraph>
      <Tabs
        activeKey={activeKey}
        onChange={handleChange}
        items={[
          {
            key: "NFE",
            label: "Nota Fiscal",
            children: <NFeGridPerPackage />,
          },
          {
            key: "DECLARACAO",
            label: "Declaração de conteúdo",
            children: useVolumeDeclarations ? <VolumeDocuments /> : <DeclarationItems />,
          },
        ]}
      />
    </Card>
  );
}
