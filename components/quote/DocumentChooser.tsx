"use client";

import { Card, Tabs, Typography } from "antd";
import { useFormContext } from "react-hook-form";
import type { DocumentType } from "@/types/quote";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import { NFeForm } from "@/components/quote/NFeForm";
import { DeclarationItems } from "@/components/quote/DeclarationItems";

export function DocumentChooser() {
  const { watch, setValue } = useFormContext<FinalizeFormValues>();
  const activeKey = watch("document.type") ?? "DECLARACAO";

  const handleChange = (key: string) => {
    setValue("document.type", key as DocumentType, { shouldDirty: true });
  };

  return (
    <Card>
      <Typography.Title level={5}>Qual documento usar?</Typography.Title>
      <Typography.Paragraph type="secondary">
        Informe se você enviará com Nota Fiscal modelo 55 ou Declaração de conteúdo.
      </Typography.Paragraph>
      <Tabs
        activeKey={activeKey}
        onChange={handleChange}
        items={[
          {
            key: "NFE",
            label: "Nota Fiscal",
            children: <NFeForm />,
          },
          {
            key: "DECLARACAO",
            label: "Declaração de conteúdo",
            children: <DeclarationItems />,
          },
        ]}
      />
    </Card>
  );
}
