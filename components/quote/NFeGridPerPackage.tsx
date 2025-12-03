"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useFormContext } from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useInvoiceItems } from "@/hooks/useInvoiceItems";
import { PackageNFeRow } from "@/components/quote/PackageNFeRow";
import type { InvoiceData } from "@/lib/types/invoice";

const { Dragger } = Upload;

function extractNFeKeyFromXml(text: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml");

    // 1) infNFe Id="NFe3519..." -> pegue só os dígitos
    const inf = doc.querySelector("infNFe");
    const id = inf?.getAttribute("Id") || inf?.getAttribute("id");
    if (id) {
      const digits = id.replace(/[^0-9]/g, "");
      if (digits.length === 44) return digits;
    }

    // 2) chNFe
    const chNode = doc.querySelector("chNFe");
    const ch = chNode?.textContent?.trim();
    if (ch && /^\d{44}$/.test(ch)) return ch;

    return null;
  } catch {
    return null;
  }
}

function getPackagesCount(): number {
  try {
    const state = useQuoteStore.getState();
    const volumes = state?.results?.resumo?.volumes;
    if (Array.isArray(volumes) && volumes.length > 0) {
      return volumes.length;
    }
  } catch {}

  return 1;
}

export function NFeGridPerPackage() {
  const { message } = App.useApp();
  const { setValue, getValues, watch } = useFormContext<FinalizeFormValues>();
  useInvoiceItems();

  const packagesCount = useMemo(() => getPackagesCount(), []);

  // Estado para armazenar invoiceData por pacote
  const [packageInvoices, setPackageInvoices] = useState<Record<number, InvoiceData | null>>({});
  const [packageLoading, setPackageLoading] = useState<Record<number, boolean>>({});
  const [packageErrors, setPackageErrors] = useState<Record<number, string | null>>({});

  // Inicializar array de pacotes no formulário
  useEffect(() => {
    const current = getValues("document.packages");
    if (!current || current.length !== packagesCount) {
      const packages = Array.from({ length: packagesCount }, (_, i) => ({
        chave: current?.[i]?.chave || "",
        xmlId: current?.[i]?.xmlId || null,
        items: current?.[i]?.items || [],
      }));
      setValue("document.packages", packages, { shouldDirty: false });
    }
  }, [packagesCount, setValue, getValues]);

  const packages = watch("document.packages") || [];
  const filledCount = packages.filter((pkg) => /^\d{44}$/.test(pkg?.chave || "")).length;

  const handleChaveChange = async (index: number, chave: string) => {
    // Se chave completa, tentar buscar itens (se ainda não tiver)
    if (chave.length === 44 && !packageInvoices[index]) {
      // Aqui poderíamos fazer uma busca por chave se tivermos endpoint
      // Por enquanto, apenas limpar estados
      setPackageInvoices((prev) => ({ ...prev, [index]: null }));
      setPackageErrors((prev) => ({ ...prev, [index]: null }));
    }
  };

  const handleXmlParse = async (index: number, xml: string) => {
    setPackageLoading((prev) => ({ ...prev, [index]: true }));
    setPackageErrors((prev) => ({ ...prev, [index]: null }));

    try {
      const response = await fetch("/api/nfe/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || "Erro ao processar XML");
      }

      setPackageInvoices((prev) => ({ ...prev, [index]: result.data }));
      setPackageErrors((prev) => ({ ...prev, [index]: null }));

      // Atualizar chave e itens no formulário
      setValue(`document.packages.${index}.chave`, result.data.chave, {
        shouldDirty: true,
      });
      setValue(`document.packages.${index}.items`, result.data.items, {
        shouldDirty: true,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao processar XML da NF-e";
      setPackageErrors((prev) => ({ ...prev, [index]: errorMessage }));
    } finally {
      setPackageLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  const uploadProps: UploadProps = {
    multiple: true,
    accept: ".xml,text/xml,application/xml",
    beforeUpload: async (file) => {
      try {
        const text = await file.text();
        const chave = extractNFeKeyFromXml(text);

        if (!chave) {
          message.error(`${file.name}: não foi possível extrair a chave da NF-e.`);
          return Upload.LIST_IGNORE;
        }

        // Procurar pacote com essa chave ou primeiro pacote vazio
        let targetIndex = packages.findIndex((pkg) => pkg?.chave === chave);

        if (targetIndex === -1) {
          // Procurar primeiro pacote vazio
          targetIndex = packages.findIndex((pkg) => !pkg?.chave || pkg.chave.length < 44);
        }

        if (targetIndex === -1) {
          message.warning(
            `${file.name}: Todos os pacotes já têm NF-e associada.`
          );
          return Upload.LIST_IGNORE;
        }

        // Parse e associação
        await handleXmlParse(targetIndex, text);
        message.success(`${file.name}: NF-e associada ao Pacote #${targetIndex + 1}`);
      } catch {
        message.error(`${file.name}: erro ao processar arquivo.`);
      }

      return Upload.LIST_IGNORE;
    },
    showUploadList: false,
  };

  const handleRetry = (index: number) => {
    setPackageInvoices((prev) => ({ ...prev, [index]: null }));
    setPackageErrors((prev) => ({ ...prev, [index]: null }));
    setPackageLoading((prev) => ({ ...prev, [index]: false }));
  };

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={16}>
      <Typography.Text type="secondary">
        {filledCount} de {packagesCount} NF-e(s) preenchidas
      </Typography.Text>

      {/* Lista de pacotes */}
      {Array.from({ length: packagesCount }, (_, i) => (
        <PackageNFeRow
          key={i}
          index={i}
          invoiceData={packageInvoices[i] || null}
          loading={packageLoading[i] || false}
          error={packageErrors[i] || null}
          onChaveChange={(chave) => handleChaveChange(i, chave)}
          onRetry={() => handleRetry(i)}
        />
      ))}

      {/* Upload global de XMLs */}
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Arraste os XMLs das NF-e ou clique para selecionar
        </p>
        <p className="ant-upload-hint">
          {filledCount >= packagesCount
            ? "Todas as NF-e foram preenchidas"
            : `${packagesCount - filledCount} NF-e(s) restante(s)`}
        </p>
      </Dragger>
    </Space>
  );
}
