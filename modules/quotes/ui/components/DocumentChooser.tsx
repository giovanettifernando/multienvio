"use client";

import { useEffect, useMemo } from "react";
import { Typography, Space, Badge } from "antd";
import { FileTextOutlined, FormOutlined } from "@ant-design/icons";
import { ELCard, ELTabs } from "@/shared/ui";
import { useFormContext } from "react-hook-form";
import type { DocumentType } from '@/shared/types/quote';
import type { FinalizeFormValues, VolumeDocument } from '@/shared/types/quoteFinalize';
import { useQuoteStore } from '@/modules/quotes/ui/state/useQuoteStore';
import { VolumeNFeTab } from "@/modules/quotes/ui/components/VolumeNFeTab";
import { VolumeDeclarationTab } from "@/modules/quotes/ui/components/VolumeDeclarationTab";

export function DocumentChooser() {
  const { watch, setValue, getValues } = useFormContext<FinalizeFormValues>();
  const activeKey = watch("document.type") ?? "DECLARACAO";
  const volumeDocuments = watch("document.volumeDocuments") ?? [];

  // Obter quantidade de volumes da cotação
  const volumes = useQuoteStore((s) => s.results?.resumo?.volumes);
  const volumeCount = useMemo(() => {
    if (Array.isArray(volumes) && volumes.length > 0) {
      return volumes.length;
    }
    return 1;
  }, [volumes]);

  // Inicializar volumeDocuments se necessário
  useEffect(() => {
    const current = getValues("document.volumeDocuments");
    if (!current || current.length !== volumeCount) {
      const docs: VolumeDocument[] = Array.from({ length: volumeCount }, (_, i) => ({
        volumeIndex: i,
        type: current?.[i]?.type ?? null,
        nfeKey: current?.[i]?.nfeKey ?? undefined,
        nfeXmlId: current?.[i]?.nfeXmlId ?? undefined,
        nfeItems: current?.[i]?.nfeItems ?? undefined,
        declarationItems: current?.[i]?.declarationItems ?? undefined,
      }));
      setValue("document.volumeDocuments", docs, { shouldDirty: false });
    }
  }, [volumeCount, setValue, getValues]);

  const handleChange = (key: string) => {
    setValue("document.type", key as DocumentType, { shouldDirty: true });
  };

  // Contar volumes com NF-e e declaração preenchidos
  const nfeCount = volumeDocuments.filter((v) => v?.type === "NFE" && v?.nfeKey).length;
  const declCount = volumeDocuments.filter(
    (v) => v?.type === "DECLARACAO" && v?.declarationItems && v.declarationItems.length > 0
  ).length;

  return (
    <ELCard>
      <Typography.Title level={5}>Qual documento usar?</Typography.Title>
      <Typography.Paragraph type="secondary">
        {volumeCount > 1
          ? "Selecione o tipo de documento para cada volume. Você pode usar NF-e para alguns volumes e Declaração para outros."
          : "Cada Volume deve ter NF ou Declaração de Conteúdo."}
      </Typography.Paragraph>
      <ELTabs
        activeKey={activeKey}
        onChange={handleChange}
        items={[
          {
            key: "NFE",
            label: (
              <Space>
                <FileTextOutlined />
                <span>Nota Fiscal</span>
                {nfeCount > 0 && <Badge count={nfeCount} style={{ backgroundColor: "#52c41a" }} />}
              </Space>
            ),
            children: <VolumeNFeTab volumeCount={volumeCount} />,
          },
          {
            key: "DECLARACAO",
            label: (
              <Space>
                <FormOutlined />
                <span>Declaração de conteúdo</span>
                {declCount > 0 && <Badge count={declCount} style={{ backgroundColor: "#1890ff" }} />}
              </Space>
            ),
            children: <VolumeDeclarationTab volumeCount={volumeCount} />,
          },
        ]}
      />
    </ELCard>
  );
}
