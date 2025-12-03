"use client";

import { useState, useEffect } from "react";
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
  Typography,
  Input,
  App,
} from "antd";
import {
  ClockCircleOutlined,
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

  const { results: storeResults, setSelection, clearResults } = useQuoteStore(
    useShallow((state) => ({
      results: state.results,
      setSelection: state.setSelection,
      clearResults: state.clearResults,
    })),
  );

  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [insuranceInput, setInsuranceInput] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  // Calculate time remaining and update every second
  useEffect(() => {
    if (!storeResults?.expiresAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expires = new Date(storeResults.expiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeRemaining("expirado");
        setIsExpiringSoon(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      setIsExpiringSoon(minutes < 5); // Warning when less than 5 minutes
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [storeResults?.expiresAt]);

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

  const confirmSelection = async (
    result: QuoteResultItem,
    insuranceValue: number | null,
    docType?: DocumentType,
  ) => {
    if (!storeResults) return;
    try {
      const response = await selectMutation.mutateAsync({
        quoteId: storeResults.quoteId,
        serviceId: result.id,
        seguro: insuranceValue ?? undefined,
      });

      // If we already have the document type (from modal or preference), finalize immediately
      if (docType) {
        finalizeSelection(
          result,
          response.selectionId,
          docType,
          insuranceValue,
          response.exigeDocumento,
          response.exigeSeguro,
        );
        return;
      }

      // Check if we need to ask for document type
      const preference = getDeclarationPreference(result.carrier);
      if (!response.exigeDocumento || preference?.docType) {
        const finalDocType = preference?.docType ?? "DECLARACAO";
        finalizeSelection(
          result,
          response.selectionId,
          finalDocType,
          insuranceValue,
          response.exigeDocumento,
          response.exigeSeguro,
        );
        return;
      }

      // Open modal to ask for document type
      setPendingSelection({
        result,
        selectionId: response.selectionId,
        exigeDocumento: response.exigeDocumento,
        exigeSeguro: response.exigeSeguro,
        seguroValor: insuranceValue,
      });
      setDeclarationModalOpen(true);
    } catch (error) {
      console.error("Erro ao confirmar seleção", error);

      // Check if it's an expiration error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("expirada") || errorMessage.includes("não pode mais ser selecionada")) {
        Modal.warning({
          title: "Cotação Expirada",
          content: (
            <div>
              <p>Os valores de frete expiraram (válidos por 30 minutos).</p>
              <p>Por favor, recalcule a cotação para obter valores atualizados.</p>
            </div>
          ),
          okText: "Entendi",
          onOk: () => {
            // Reset quote results to force user to recalculate
            clearResults();
          },
        });
      } else {
        message.error("Não foi possível confirmar a seleção. Tente novamente.");
      }
    } finally {
      setInsuranceModalOpen(false);
    }
  };

  const handleSelectClick = (result: QuoteResultItem) => {
    if (!storeResults) return;
    if (needsInsuranceValue(result)) {
      setInsuranceInput(storeResults.resumo.seguroValor ?? null);
      setInsuranceModalOpen(true);
      return;
    }
    confirmSelection(result, storeResults.resumo.seguroValor ?? null);
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
    // Just close the modal - user can select again if needed
    // The backend now allows re-selection (SELECTED status is valid)
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
        <Button
          type="primary"
          onClick={() => handleSelectClick(record)}
          disabled={timeRemaining === "expirado"}
        >
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
        styles={{ body: { padding: "16px 12px" } }}
      >
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          {/* Expiration warning - compact style */}
          {timeRemaining && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 6,
                background: timeRemaining === "expirado"
                  ? '#fff2f0'
                  : isExpiringSoon
                    ? '#fffbe6'
                    : '#fafafa',
                border: `1px solid ${
                  timeRemaining === "expirado"
                    ? '#ffccc7'
                    : isExpiringSoon
                      ? '#ffe58f'
                      : '#e8e8e8'
                }`,
              }}
            >
              <ClockCircleOutlined
                style={{
                  fontSize: 14,
                  color: timeRemaining === "expirado"
                    ? '#ff4d4f'
                    : isExpiringSoon
                      ? '#faad14'
                      : '#8c8c8c'
                }}
              />
              <Typography.Text
                style={{
                  fontSize: 13,
                  margin: 0,
                  color: timeRemaining === "expirado"
                    ? '#ff4d4f'
                    : '#595959'
                }}
              >
                {timeRemaining === "expirado" ? (
                  <>Cotação expirada – recalcule para obter valores atualizados</>
                ) : (
                  <>
                    Tempo restante: <Typography.Text strong style={{ fontSize: 13 }}>{timeRemaining}</Typography.Text> – valores válidos por 30 minutos
                  </>
                )}
              </Typography.Text>
            </div>
          )}

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
            scroll={{ x: 700 }}
          />
        </Space>
      </Card>

      <Modal
        title="Informe o valor do seguro"
        open={insuranceModalOpen}
        onCancel={() => {
          setInsuranceModalOpen(false);
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
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
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
