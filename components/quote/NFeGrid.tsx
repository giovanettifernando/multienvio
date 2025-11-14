"use client";

import { useEffect, useMemo } from "react";
import { App, Form, Input, Space, Table, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useFieldArray, useFormContext } from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useInvoiceItems } from "@/hooks/useInvoiceItems";
import { InvoiceItemsTable } from "@/components/quote/InvoiceItemsTable";

const { Dragger } = Upload;

function normalize44(v: string) {
  return (v || "").replace(/\D/g, "").slice(0, 44);
}

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

type NFeRow = { chave: string };

export function NFeGrid() {
  const { message } = App.useApp();
  const { control, setValue, getValues, watch, formState: { errors } } = useFormContext<FinalizeFormValues>();
  const { data: invoiceData, loading: loadingItems, error: itemsError, parseXml, reset: resetItems } = useInvoiceItems();

  const packagesCount = useMemo(() => getPackagesCount(), []);

  // Atualizar itens no formulário quando invoiceData mudar
  useEffect(() => {
    if (invoiceData?.items) {
      setValue("document.nfeItems", invoiceData.items, {
        shouldDirty: true,
      });
    }
  }, [invoiceData, setValue]);

  // Gerencia o array de chaves
  const { replace } = useFieldArray({
    control,
    name: "document.nfeKeys" as const
  });

  // Garante que o array tenha o tamanho exato
  useEffect(() => {
    const current = getValues("document.nfeKeys");
    const currentArray: NFeRow[] = (current ?? []) as NFeRow[];
    if (currentArray.length !== packagesCount) {
      const next = Array.from({ length: packagesCount }, (_, i) => ({
        chave: currentArray[i]?.chave ?? ""
      }));
      replace(next);
    }
  }, [packagesCount, replace, getValues]);

  const data = watch("document.nfeKeys");
  const dataArray: NFeRow[] = (data ?? []) as NFeRow[];
  const filled = dataArray.filter(r => /^\d{44}$/.test(r?.chave ?? "")).length;

  const fillNextEmpty = (chave: string) => {
    const current = getValues("document.nfeKeys");
    const currentArray: NFeRow[] = (current ?? []) as NFeRow[];

    // Verifica duplicata
    const already = currentArray.some(r => r?.chave === chave);
    if (already) {
      message.warning("Chave já informada.");
      return false;
    }

    // Encontra primeira linha vazia
    const idx = currentArray.findIndex(r => !/^\d{44}$/.test(r?.chave ?? ""));
    if (idx === -1) {
      message.info("Todas as chaves já foram preenchidas.");
      return false;
    }

    setValue(`document.nfeKeys.${idx}.chave` as `document.nfeKeys.${number}.chave`, chave, {
      shouldDirty: true,
      shouldValidate: true
    });
    return true;
  };

  const uploadProps: UploadProps = {
    multiple: true,
    accept: ".xml,text/xml,application/xml",
    beforeUpload: async (file) => {
      const current = getValues("document.nfeKeys");
      const currentArray: NFeRow[] = (current ?? []) as NFeRow[];
      const remaining = packagesCount - currentArray.filter(r => /^\d{44}$/.test(r?.chave ?? "")).length;

      if (remaining <= 0) {
        message.info("Você já preencheu todas as chaves para os pacotes.");
        return Upload.LIST_IGNORE;
      }

      try {
        const text = await file.text();
        const chave = extractNFeKeyFromXml(text);

        if (!chave) {
          message.error(`${file.name}: não foi possível extrair a chave da NF-e.`);
          return Upload.LIST_IGNORE;
        }

        const ok = fillNextEmpty(chave);
        if (ok) {
          message.success(`${file.name}: chave adicionada.`);
          // Parse do XML para obter itens
          parseXml(text);
        }
      } catch {
        message.error(`${file.name}: erro ao processar arquivo.`);
      }

      return Upload.LIST_IGNORE;
    },
    showUploadList: false,
  };

  const columns = [
    {
      title: "Pacote",
      dataIndex: "index",
      key: "idx",
      width: 90,
      render: (_value: unknown, _record: NFeRow, idx: number) => <span>#{idx + 1}</span>,
    },
    {
      title: "Chave da NF-e (44 dígitos)",
      dataIndex: "chave",
      key: "chave",
      render: (_value: unknown, _record: NFeRow, idx: number) => {
        const errorPath = errors?.document?.nfeKeys;
        const fieldError = errorPath && Array.isArray(errorPath) ? errorPath[idx]?.chave : undefined;

        return (
          <Form.Item
            style={{ marginBottom: 0 }}
            validateStatus={fieldError ? "error" : undefined}
            help={fieldError?.message as string | undefined}
          >
            <Input
              value={dataArray[idx]?.chave ?? ""}
              placeholder="Digite/cole a chave (44 dígitos)"
              inputMode="numeric"
              maxLength={44}
              onChange={(e) => {
                const digits = normalize44(e.target.value);
                setValue(`document.nfeKeys.${idx}.chave` as `document.nfeKeys.${number}.chave`, digits, {
                  shouldDirty: true,
                  shouldValidate: true
                });
              }}
            />
          </Form.Item>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Typography.Text type="secondary">
        {filled} de {packagesCount} chaves preenchidas
      </Typography.Text>

      <Table
        size="small"
        bordered
        pagination={false}
        rowKey={(_, i) => String(i)}
        dataSource={Array.from({ length: packagesCount }, (_, i) => ({
          chave: dataArray?.[i]?.chave ?? ""
        }))}
        columns={columns}
      />

      <Dragger {...uploadProps} disabled={filled >= packagesCount}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Arraste o XML da NF-e ou clique para selecionar
        </p>
        <p className="ant-upload-hint">
          {filled >= packagesCount
            ? "Todas as chaves foram preenchidas"
            : `${packagesCount - filled} chave(s) restante(s)`
          }
        </p>
      </Dragger>

      {/* Tabela de itens da NF-e */}
      <InvoiceItemsTable
        items={invoiceData?.items || null}
        loading={loadingItems}
        error={itemsError}
        onRetry={resetItems}
      />
    </Space>
  );
}
