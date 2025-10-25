"use client";

import type { CSSProperties } from "react";
import { Button, Card, Divider, Flex, Space, Typography } from "antd";
import type {
  OrigemDestinoInput,
  PacoteQuoteInput,
} from "@/lib/validation/quote";
import type { QuoteResult } from "@/components/ui/QuoteResultCard";

type QuoteSummaryProps = {
  origemDestino: OrigemDestinoInput;
  pacote: PacoteQuoteInput;
  onEdit?: () => void;
  cotacaoId?: string | null;
  onExportCsv?: () => void;
  onSaveQuote?: () => void;
  destinoInfo?: {
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  origemInfo?: {
    cidade: string;
    uf: string;
  } | null;
  results?: QuoteResult[];
};

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export function QuoteSummary({
  origemDestino,
  pacote,
  onEdit,
  cotacaoId,
  onExportCsv,
  onSaveQuote,
  destinoInfo,
  origemInfo,
  results,
}: QuoteSummaryProps) {
  const menorValor =
    results && results.length
      ? Math.min(...results.map((result) => result.price))
      : null;

  return (
    <Card
      title={
        <Flex justify="space-between" align="center">
          <Typography.Text strong>Resumo da Cotação</Typography.Text>
          {onEdit ? (
            <Button
              type="link"
              size="small"
              onClick={onEdit}
              aria-label="Editar informações da cotação"
            >
              Editar
            </Button>
          ) : null}
        </Flex>
      }
      bodyStyle={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}
      style={{
        position: "sticky",
        top: 16,
        width: 320,
        borderRadius: 8,
        boxShadow: "0 6px 24px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Space direction="vertical" size={12}>
        <div style={sectionStyle}>
          <Typography.Text type="secondary">Origem</Typography.Text>
          <Typography.Text strong>
            {origemDestino.cepOrigem}
          </Typography.Text>
          {origemInfo ? (
            <Typography.Text type="secondary">
              {`${origemInfo.cidade} - ${origemInfo.uf}`}
            </Typography.Text>
          ) : null}
        </div>
        <div style={sectionStyle}>
          <Typography.Text type="secondary">Destino</Typography.Text>
          <Typography.Text strong>
            {origemDestino.cepDestino || "-"}
          </Typography.Text>
          {destinoInfo ? (
            <Typography.Text type="secondary">
              {destinoInfo.bairro
                ? `${destinoInfo.bairro}, ${destinoInfo.cidade} - ${destinoInfo.uf}`
                : `${destinoInfo.cidade} - ${destinoInfo.uf}`}
            </Typography.Text>
          ) : null}
        </div>
        <div style={sectionStyle}>
          <Typography.Text type="secondary">Pacote</Typography.Text>
          <Typography.Text strong>
            {`${pacote.comprimentoCm} x ${pacote.larguraCm} x ${pacote.alturaCm} cm / ${pacote.pesoKg.toFixed(2)} kg`}
          </Typography.Text>
        </div>
        <div style={sectionStyle}>
          <Typography.Text type="secondary">Valor declarado</Typography.Text>
          <Typography.Text strong>
            {pacote.valorDeclarado.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </Typography.Text>
        </div>
        <div style={sectionStyle}>
          <Typography.Text type="secondary">Categoria</Typography.Text>
          <Typography.Text strong>{pacote.categoria}</Typography.Text>
        </div>
      </Space>

      <Divider style={{ margin: "0" }} />

      <Space direction="vertical" size={4}>
        <Typography.Text type="secondary">Total estimado</Typography.Text>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {menorValor
            ? menorValor.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })
            : "-"}
        </Typography.Title>
      </Space>

      <Space direction="vertical" size={8}>
        <Button
          onClick={onExportCsv}
          block
          aria-label="Exportar cotação em CSV"
        >
          Exportar CSV
        </Button>
        <Button
          type="primary"
          block
          onClick={onSaveQuote}
          disabled={!cotacaoId}
          aria-label="Salvar cotação"
        >
          Salvar Cotação
        </Button>
      </Space>
    </Card>
  );
}
