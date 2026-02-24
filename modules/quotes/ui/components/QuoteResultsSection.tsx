"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ELAlert,
  ELAvatar,
  ELEmpty,
  ELFlexAntd,
  ELSpace,
  ELSpin,
  ELTypography,
  ELInput,
  useELApp,
  EL_EMPTY_PRESENTED_IMAGE_SIMPLE,
} from '@/shared/ui';
import { formatBRL } from '@/shared/utils/format';
const Alert = ELAlert;
const Avatar = ELAvatar;
const Empty = ELEmpty;
const Flex = ELFlexAntd;
const Space = ELSpace;
const Spin = ELSpin;
const Typography = ELTypography;
const Input = ELInput;
const App = { useApp: useELApp };
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { ELModal } from '@/shared/ui/ELModal';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import {
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { QuoteResultItem, DocumentType, EligibilityResponse } from '@/shared/types/quote';
import { ContentDeclarationModal } from "./ContentDeclarationModal";
import { useQuoteSelection } from "@/modules/quotes/ui/hooks";
import { useQuoteStore } from '@/modules/quotes/ui/state/useQuoteStore';
import { useShallow } from "zustand/react/shallow";
import { useCarrierIcons } from "@/shared/hooks";

/**
 * Deriva o slug da transportadora a partir do nome.
 */
const deriveCarrierSlug = (carrierName: string): string => {
  return carrierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
};

/**
 * Gera as iniciais do nome da transportadora.
 */
const buildAvatarLabel = (carrier: string) => {
  const initials = carrier
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "T";
};

type QuoteResultsSectionProps = {
  results: QuoteResultItem[] | null;
  loading: boolean;
  error: string | null;
  onCalculate: () => void;
  canCalculate: boolean;
  /** Informações de elegibilidade da última cotação */
  eligibility?: EligibilityResponse | null;
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
  eligibility,
}: QuoteResultsSectionProps) {
  const router = useRouter();
  const { message, modal } = App.useApp();
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
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({});

  const { carrierIcons } = useCarrierIcons();

  const handleIconError = (slug: string) => {
    setIconErrors((prev) => ({ ...prev, [slug]: true }));
  };

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
        modal.warning({
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
      <ELCard style={{ height: "100%", minHeight: 400 }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Resultados da cotação
          </Typography.Title>
          <div style={{ display: "flex", justifyContent: "center", flex: 1, alignItems: "center", minHeight: 200 }}>
            <ELButton
              variant="primary"
              size="large"
              onClick={onCalculate}
              disabled={!canCalculate}
            >
              Calcular
            </ELButton>
          </div>
        </Space>
      </ELCard>
    );
  }

  // Estado de loading
  if (loading) {
    return (
      <ELCard style={{ height: "100%", minHeight: 400 }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Resultados da cotação
          </Typography.Title>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 16,
            }}
          >
            <Spin size="large" />
            <Typography.Text type="secondary">
              Calculando cotações...
            </Typography.Text>
          </div>
        </Space>
      </ELCard>
    );
  }

  // Estado de erro
  if (error) {
    return (
      <ELCard style={{ height: "100%", minHeight: 400 }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Resultados da cotação
          </Typography.Title>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 16,
            }}
          >
            <Alert
              title="Erro ao calcular cotações"
              description={error}
              type="error"
              showIcon
              style={{ width: "100%" }}
            />
            <ELButton variant="primary" onClick={onCalculate} disabled={!canCalculate}>
              Tentar novamente
            </ELButton>
          </div>
        </Space>
      </ELCard>
    );
  }

  // Estado de resultados vazios
  if (results && results.length === 0) {
    return (
      <ELCard style={{ height: "100%", minHeight: 400 }}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={5} style={{ marginBottom: 0 }}>
            Resultados da cotação
          </Typography.Title>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 200,
              gap: 16,
            }}
          >
            {eligibility?.hasBlockingVolumes ? (
              <Alert
                title="Algum dos volumes está fora das medidas das transportadoras. Revise para continuar."
                type="warning"
                showIcon
                style={{ width: "100%" }}
              />
            ) : (
              <Empty
                description="Nenhuma cotação disponível para os parâmetros informados"
                image={EL_EMPTY_PRESENTED_IMAGE_SIMPLE}
              />
            )}
            <ELButton variant="primary" onClick={onCalculate} disabled={!canCalculate}>
              Calcular novamente
            </ELButton>
          </div>
        </Space>
      </ELCard>
    );
  }

  // Estado com resultados
  const columns: DataTableColumn<QuoteResultItem>[] = [
    {
      title: "Transportadora",
      dataIndex: "carrier",
      key: "carrier",
      width: 180,
      render: (text: unknown) => {
        const carrierName = text as string;
        const slug = deriveCarrierSlug(carrierName);
        const iconUrl = carrierIcons[slug];
        const hasError = iconErrors[slug];
        const showIcon = iconUrl && !hasError;

        return (
          <Flex align="center" gap={8}>
            {showIcon ? (
              <Avatar
                shape="square"
                size={28}
                src={iconUrl}
                style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", flexShrink: 0 }}
                onError={() => {
                  handleIconError(slug);
                  return false;
                }}
              >
                {buildAvatarLabel(carrierName)}
              </Avatar>
            ) : (
              <Avatar
                shape="square"
                size={28}
                style={{ backgroundColor: "#1d39c4", color: "#fff", flexShrink: 0 }}
              >
                {buildAvatarLabel(carrierName)}
              </Avatar>
            )}
            <Typography.Text strong>{carrierName}</Typography.Text>
          </Flex>
        );
      },
      showInCard: true,
    },
    {
      title: "Serviço",
      dataIndex: "modalidade",
      key: "modalidade",
      width: 120,
      showInCard: true,
    },
    {
      title: "Preço",
      dataIndex: "preco",
      key: "preco",
      width: 100,
      render: (value: unknown) => (
        <Typography.Text strong style={{ color: "#52c41a" }}>
          {formatBRL(value as number)}
        </Typography.Text>
      ),
      sorter: (a: QuoteResultItem, b: QuoteResultItem) => a.preco - b.preco,
      showInCard: true,
      cardLabel: "Valor",
    },
    {
      title: "Prazo",
      dataIndex: "prazoDias",
      key: "prazoDias",
      width: 120,
      render: (days: unknown) => `${days as number} ${(days as number) === 1 ? "dia útil" : "dias úteis"}`,
      sorter: (a: QuoteResultItem, b: QuoteResultItem) =>
        a.prazoDias - b.prazoDias,
      showInCard: true,
    },
    {
      title: "Ação",
      key: "action",
      width: 100,
      fixed: "right",
      isActions: true,
      render: (_: unknown, record: QuoteResultItem) => (
        <ELButton
          variant="primary"
          size="small"
          onClick={() => handleSelectClick(record)}
          disabled={timeRemaining === "expirado"}
        >
          Escolher
        </ELButton>
      ),
    },
  ];

  return (
    <>
      <ELCard style={{ height: "100%" }} padding="md">
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Typography.Title level={5} style={{ marginBottom: 0 }}>
              Resultados da cotação
            </Typography.Title>
            <ELButton onClick={onCalculate} disabled={!canCalculate}>
              Recalcular
            </ELButton>
          </Flex>
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

          {/* Aviso quando há volumes bloqueantes */}
          {eligibility?.hasBlockingVolumes && (
            <Alert
              title="Algum dos volumes está fora das medidas das transportadoras. Revise para continuar."
              type="warning"
              showIcon
            />
          )}

          <Alert
            title={`${results?.length || 0} ${results?.length === 1 ? "cotação encontrada" : "cotações encontradas"}`}
            type="success"
            showIcon
          />

          <DataTable
            data={results || []}
            columns={columns}
            rowKey="id"
            pagination={false}
            compact
            scrollX={700}
            enableMobileCards
          />
        </Space>
      </ELCard>

      <ELModal
        title="Informe o valor do seguro"
        open={insuranceModalOpen}
        size="sm"
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
      </ELModal>

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
