"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Input,
  App,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import type { QuoteResultItem, DocumentType } from "@/types/quote";
import { ContentDeclarationModal } from "./ContentDeclarationModal";
import { useQuoteSelection } from "@/hooks/useQuotes";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useShallow } from "zustand/react/shallow";

type QuoteResultsSectionProps = {
  results: QuoteResultItem[] | null;
  loading: boolean;
  error: string | null;
  onCalculate: () => void;
  canCalculate: boolean;
};

type PendingSelection = {
  result: QuoteResultItem;
  selectionId: string;
  exigeDocumento: boolean;
  exigeSeguro: boolean;
  seguroValor: number | null;
};

const getDeclarationPreference = (
  carrier: string,
): { docType: DocumentType } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `contentDeclaration:${carrier}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { docType: DocumentType };
    if (parsed.docType === "NFE" || parsed.docType === "DECLARACAO") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const setDeclarationPreference = (
  carrier: string,
  docType: DocumentType,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `contentDeclaration:${carrier}`,
    JSON.stringify({ docType }),
  );
};

export function QuoteResultsSection({
  results,
  loading,
  error,
  onCalculate,
  canCalculate,
}: QuoteResultsSectionProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const selectMutation = useQuoteSelection();

  const { results: storeResults, setSelection } = useQuoteStore(
    useShallow((state) => ({
      results: state.results,
      setSelection: state.setSelection,
    })),
  );

  const [selectedResult, setSelectedResult] = useState<QuoteResultItem | null>(
    null,
  );
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [insuranceInput, setInsuranceInput] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);

  const needsInsuranceValue = (
    result: QuoteResultItem,
  ) =>
    result.exigeSeguro &&
    (!storeResults?.resumo.seguroValor ||
      storeResults.resumo.seguroValor <= 0);

  const finalizeSelection = (
    result: QuoteResultItem,
    selectionId: string,
    docType: DocumentType,
    seguroValor: number | null,
    exigeDocumento: boolean,
    exigeSeguro: boolean,
  ) => {
    if (!storeResults) return;

    setSelection({
      selectionId,
      quoteId: storeResults.quoteId,
      result,
      exigeDocumento,
      exigeSeguro,
      documento: docType,
      seguroValor: seguroValor ?? null,
    });

    router.push(`/cotacoes/finalizar?selectionId=${selectionId}&doc=${docType}`);
  };

  const handleSelectionResponse = (
    result: QuoteResultItem,
    selectionId: string,
    exigeDocumento: boolean,
    exigeSeguro: boolean,
    seguroValor: number | null,
  ) => {
    const preference = getDeclarationPreference(result.carrier);
    if (!exigeDocumento || preference?.docType) {
      const docType = preference?.docType ?? "DECLARACAO";
      finalizeSelection(
        result,
        selectionId,
        docType,
        seguroValor,
        exigeDocumento,
        exigeSeguro,
      );
      return;
    }

    setPendingSelection({
      result,
      selectionId,
      exigeDocumento,
      exigeSeguro,
      seguroValor,
    });
    setDeclarationModalOpen(true);
  };

  const confirmSelection = async (
    result: QuoteResultItem,
    insuranceValue: number | null,
  ) => {
    if (!storeResults) return;
    try {
      const response = await selectMutation.mutateAsync({
        quoteId: storeResults.quoteId,
        serviceId: result.id,
        seguro: insuranceValue ?? undefined,
      });
      handleSelectionResponse(
        result,
        response.selectionId,
        response.exigeDocumento,
        response.exigeSeguro,
        insuranceValue,
      );
    } catch (error) {
      console.error("Erro ao confirmar seleção", error);
      message.error("Não foi possível confirmar a seleção. Tente novamente.");
    } finally {
      setSelectedResult(null);
      setInsuranceModalOpen(false);
    }
  };

  const handleSelectClick = (result: QuoteResultItem) => {
    if (!storeResults) return;

    setSelectedResult(result);
    if (needsInsuranceValue(result)) {
      setInsuranceInput(storeResults.resumo.seguroValor ?? null);
      setInsuranceModalOpen(true);
      return;
    }
    confirmSelection(result, storeResults.resumo.seguroValor ?? null);
  };

  const handleInsuranceConfirm = () => {
    if (!selectedResult) {
      setInsuranceModalOpen(false);
      return;
    }
    if (!insuranceInput || insuranceInput <= 0) {
      message.error("Informe um valor válido para o seguro.");
      return;
    }
    confirmSelection(selectedResult, insuranceInput);
  };

  const handleDeclarationAgree = ({ remember }: { remember: boolean }) => {
    if (!pendingSelection) return;
    if (remember) {
      setDeclarationPreference(pendingSelection.result.carrier, "DECLARACAO");
    }
    setDeclarationModalOpen(false);
    finalizeSelection(
      pendingSelection.result,
      pendingSelection.selectionId,
      "DECLARACAO",
      pendingSelection.seguroValor,
      pendingSelection.exigeDocumento,
      pendingSelection.exigeSeguro,
    );
    setPendingSelection(null);
  };

  const handleDeclarationNfe = ({ remember }: { remember: boolean }) => {
    if (!pendingSelection) return;
    if (remember) {
      setDeclarationPreference(pendingSelection.result.carrier, "NFE");
    }
    setDeclarationModalOpen(false);
    finalizeSelection(
      pendingSelection.result,
      pendingSelection.selectionId,
      "NFE",
      pendingSelection.seguroValor,
      pendingSelection.exigeDocumento,
      pendingSelection.exigeSeguro,
    );
    setPendingSelection(null);
  };

  const handleDeclarationClose = () => {
    setPendingSelection(null);
    setDeclarationModalOpen(false);
  };

  // Estado inicial: sem resultados e sem loading
  if (!loading && !results && !error) {
    return (
      <Card
        title="Resultados da cotação"
        style={{ height: "100%", minHeight: 400 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
            gap: 16,
          }}
        >
          <Empty
            description="Preencha os dados e clique em Calcular para ver as cotações"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <Button
            type="primary"
            size="large"
            onClick={onCalculate}
            disabled={!canCalculate}
          >
            Calcular
          </Button>
        </div>
      </Card>
    );
  }

  // Estado de loading
  if (loading) {
    return (
      <Card title="Resultados da cotação" style={{ height: "100%", minHeight: 400 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
            gap: 16,
          }}
        >
          <Spin size="large" />
          <Typography.Text type="secondary">
            Calculando cotações...
          </Typography.Text>
        </div>
      </Card>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <Card title="Resultados da cotação" style={{ height: "100%", minHeight: 400 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
            gap: 16,
          }}
        >
          <Alert
            message="Erro ao calcular cotações"
            description={error}
            type="error"
            showIcon
            style={{ width: "100%" }}
          />
          <Button type="primary" onClick={onCalculate} disabled={!canCalculate}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  // Estado de resultados vazios
  if (results && results.length === 0) {
    return (
      <Card title="Resultados da cotação" style={{ height: "100%", minHeight: 400 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
            gap: 16,
          }}
        >
          <Empty
            description="Nenhuma cotação disponível para os parâmetros informados"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
          <Button type="primary" onClick={onCalculate} disabled={!canCalculate}>
            Calcular novamente
          </Button>
        </div>
      </Card>
    );
  }

  // Estado com resultados
  const columns = [
    {
      title: "Transportadora",
      dataIndex: "carrier",
      key: "carrier",
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: "Serviço",
      dataIndex: "modalidade",
      key: "modalidade",
    },
    {
      title: "Preço",
      dataIndex: "preco",
      key: "preco",
      render: (value: number) => (
        <Typography.Text strong style={{ color: "#52c41a" }}>
          R$ {value.toFixed(2)}
        </Typography.Text>
      ),
      sorter: (a: QuoteResultItem, b: QuoteResultItem) => a.preco - b.preco,
    },
    {
      title: "Prazo",
      dataIndex: "prazoDias",
      key: "prazoDias",
      render: (days: number) => `${days} ${days === 1 ? "dia útil" : "dias úteis"}`,
      sorter: (a: QuoteResultItem, b: QuoteResultItem) =>
        a.prazoDias - b.prazoDias,
    },
    {
      title: "Ação",
      key: "action",
      render: (_: unknown, record: QuoteResultItem) => (
        <Button type="primary" onClick={() => handleSelectClick(record)}>
          Escolher
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Resultados da cotação"
        extra={
          <Button onClick={onCalculate} disabled={!canCalculate}>
            Recalcular
          </Button>
        }
        style={{ height: "100%" }}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            message={`${results?.length || 0} ${results?.length === 1 ? "cotação encontrada" : "cotações encontradas"}`}
            type="success"
            showIcon
          />

          <Table
            dataSource={results || []}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 800 }}
          />
        </Space>
      </Card>

      <Modal
        title="Informe o valor do seguro"
        open={insuranceModalOpen}
        onCancel={() => {
          setInsuranceModalOpen(false);
          setSelectedResult(null);
        }}
        onOk={() => {
          if (!insuranceInput || insuranceInput <= 0) {
            message.error("Informe um valor válido para o seguro.");
            return;
          }
          setInsuranceModalOpen(false);
        }}
        okText="Confirmar"
        cancelText="Cancelar"
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph>
            A transportadora exige a informação do valor segurado para concluir a
            seleção.
          </Typography.Paragraph>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor da carga"
            value={insuranceInput ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              setInsuranceInput(raw === "" ? null : Number(raw));
            }}
            prefix="R$"
          />
        </Space>
      </Modal>

      <ContentDeclarationModal
        open={declarationModalOpen}
        carrierName={pendingSelection?.result.carrier ?? ""}
        onAgree={handleDeclarationAgree}
        onSendNfe={handleDeclarationNfe}
        onClose={handleDeclarationClose}
      />
    </>
  );
}
