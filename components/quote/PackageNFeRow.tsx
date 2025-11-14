"use client";

import { useEffect } from "react";
import { Card, Form, Input, Space, Typography } from "antd";
import { useFormContext } from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import type { InvoiceData } from "@/lib/types/invoice";
import { InvoiceItemsTable } from "@/components/quote/InvoiceItemsTable";

function normalize44(v: string) {
  return (v || "").replace(/\D/g, "").slice(0, 44);
}

export interface PackageNFeRowProps {
  index: number;
  invoiceData: InvoiceData | null;
  loading: boolean;
  error: string | null;
  onChaveChange: (chave: string) => void;
  onRetry: () => void;
}

export function PackageNFeRow({
  index,
  invoiceData,
  loading,
  error,
  onChaveChange,
  onRetry,
}: PackageNFeRowProps) {
  const { setValue, watch, formState: { errors } } = useFormContext<FinalizeFormValues>();

  const packageData = watch(`document.packages.${index}`);
  const chave = packageData?.chave || "";

  // Atualizar itens no formulário quando invoiceData mudar
  useEffect(() => {
    if (invoiceData?.items) {
      setValue(`document.packages.${index}.items`, invoiceData.items, {
        shouldDirty: true,
      });
    }
  }, [invoiceData, index, setValue]);

  const fieldError = errors?.document?.packages?.[index]?.chave;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      {/* Linha com identificador do pacote e campo de chave */}
      <Card size="small">
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Typography.Text strong>Pacote #{index + 1}</Typography.Text>

          <Form.Item
            label="Chave da NF-e (44 dígitos)"
            validateStatus={fieldError ? "error" : undefined}
            help={fieldError?.message as string | undefined}
            style={{ marginBottom: 0 }}
          >
            <Input
              value={chave}
              placeholder="Digite/cole a chave (44 dígitos)"
              inputMode="numeric"
              maxLength={44}
              onChange={(e) => {
                const digits = normalize44(e.target.value);
                setValue(`document.packages.${index}.chave`, digits, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                onChaveChange(digits);
              }}
            />
          </Form.Item>
        </Space>
      </Card>

      {/* Grid de itens do pacote */}
      {chave.length === 44 && (
        <InvoiceItemsTable
          items={invoiceData?.items || null}
          loading={loading}
          error={error}
          onRetry={onRetry}
        />
      )}

      {chave.length > 0 && chave.length < 44 && (
        <Card>
          <Typography.Text type="secondary">
            Complete a chave da NF-e para visualizar os itens
          </Typography.Text>
        </Card>
      )}

      {!chave && (
        <Card>
          <Typography.Text type="secondary">
            Nenhuma Nota Fiscal carregada para este pacote.
          </Typography.Text>
        </Card>
      )}
    </Space>
  );
}
