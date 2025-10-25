"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { App, Flex, Input, Modal, Space, Typography } from "antd";
import { useShallow } from "zustand/react/shallow";
import { ResultsBanner } from "@/components/quote/ResultsBanner";
import { ResultsTable } from "@/components/quote/ResultsTable";
import { ContentDeclarationModal } from "@/components/quote/ContentDeclarationModal";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useQuoteSelection } from "@/hooks/useQuotes";
import type {
  DocumentType,
  QuoteResultItem,
  QuoteResultsState,
} from "@/types/quote";

type SortOrder = "price" | "prazo";

const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

type DeclarationPreference = {
  docType: DocumentType;
};

const getDeclarationPreference = (
  carrier: string,
): DeclarationPreference | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `contentDeclaration:${carrier}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeclarationPreference;
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

type PendingSelection = {
  result: QuoteResultItem;
  selectionId: string;
  exigeDocumento: boolean;
  exigeSeguro: boolean;
  seguroValor: number | null;
};

export default function QuoteResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const selectMutation = useQuoteSelection();

  const {
    results,
    setSelection,
    updateSummary,
  } = useQuoteStore(
    useShallow((state) => ({
      results: state.results,
      setSelection: state.setSelection,
      updateSummary: state.updateSummary,
    })),
  );

  const summary = results?.resumo ?? null;
  const [sortOrder, setSortOrder] = useState<SortOrder>("price");
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState(summary?.lembrete ?? "");
  const [selectedResult, setSelectedResult] = useState<QuoteResultItem | null>(
    null,
  );
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [insuranceInput, setInsuranceInput] = useState<number | null>(null);
  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);

  useEffect(() => {
    if (!results) {
      router.replace("/cotacoes");
    }
  }, [results, router]);

  useEffect(() => {
    const ordenar = searchParams.get("ordenar");
    if (ordenar === "prazo") {
      setSortOrder("prazo");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!results || !summary) return;
    dispatchTelemetry("quote_results_view", {
      quoteId: results.quoteId,
      volumesCount: summary.volumes.length,
      pesoTotalKg: summary.volumes.reduce(
        (acc, volume) => acc + volume.pesoKg,
        0,
      ),
      pesoCubadoTotalKg: summary.volumes.reduce((acc, volume) => {
        const cubado =
          (volume.comprimentoCm * volume.larguraCm * volume.alturaCm) / 6000;
        return acc + cubado;
      }, 0),
      coleta: summary.coleta,
      devolucao: summary.devolucao,
      ordenacao: sortOrder,
      hasInsuranceValue: Boolean(summary.seguroValor),
    });
  }, [results, sortOrder, summary]);

  useEffect(() => {
    setReminderDraft(summary?.lembrete ?? "");
  }, [summary?.lembrete]);

  const handleReminderSave = () => {
    const trimmed = reminderDraft.trim();
    updateSummary({ lembrete: trimmed ? trimmed : null });
    setReminderModalOpen(false);
    if (trimmed) {
      message.success("Lembrete atualizado.");
    } else {
      message.success("Lembrete removido.");
    }
  };

  const handleReminderRemove = () => {
    updateSummary({ lembrete: null });
    setReminderDraft("");
    message.success("Lembrete removido.");
  };

  const handleEditVolumes = () => {
    router.push("/cotacoes");
  };

  const needsInsuranceValue = (
    result: QuoteResultItem,
    currentResults: QuoteResultsState,
  ) =>
    result.exigeSeguro &&
    (!currentResults.resumo.seguroValor ||
      currentResults.resumo.seguroValor <= 0);

  const finalizeSelection = (
    result: QuoteResultItem,
    selectionId: string,
    docType: DocumentType,
    seguroValor: number | null,
    exigeDocumento: boolean,
    exigeSeguro: boolean,
  ) => {
    if (!results) return;
    setSelection({
      selectionId,
      quoteId: results.quoteId,
      result,
      exigeDocumento,
      exigeSeguro,
      documento: docType,
      seguroValor: seguroValor ?? null,
    });
    if (seguroValor !== null) {
      updateSummary({ seguroValor });
    }
    dispatchTelemetry("quote_select", {
      quoteId: results.quoteId,
      selectionId,
      serviceId: result.id,
      docType,
    });
    router.push(
      `/cotacoes/finalizar?selectionId=${selectionId}&doc=${docType}`,
    );
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
    if (!results) return;
    try {
      const response = await selectMutation.mutateAsync({
        quoteId: results.quoteId,
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

  const handleSelectResult = (result: QuoteResultItem) => {
    if (!results) return;
    setSelectedResult(result);
    if (needsInsuranceValue(result, results)) {
      setInsuranceInput(results.resumo.seguroValor ?? null);
      setInsuranceModalOpen(true);
      return;
    }
    confirmSelection(result, results.resumo.seguroValor ?? null);
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

  if (!results || !summary) {
    return null;
  }

  return (
    <>
      <Flex vertical gap={24}>
        <ResultsBanner
          summary={summary}
          onEditVolumes={handleEditVolumes}
          onEditReminder={() => setReminderModalOpen(true)}
          onRemoveReminder={handleReminderRemove}
        />

        <ResultsTable
          results={results.results}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onSelect={handleSelectResult}
          loading={selectMutation.isPending}
        />
      </Flex>

      <Modal
        title="Editar lembrete"
        open={reminderModalOpen}
        onCancel={() => setReminderModalOpen(false)}
        onOk={handleReminderSave}
        okText="Salvar"
        cancelText="Cancelar"
      >
        <Input
          value={reminderDraft}
          onChange={(event) => setReminderDraft(event.target.value.slice(0, 40))}
          maxLength={40}
          placeholder="Até 40 caracteres"
        />
      </Modal>

      <Modal
        title="Informe o valor do seguro"
        open={insuranceModalOpen}
        onCancel={() => {
          setInsuranceModalOpen(false);
          setSelectedResult(null);
        }}
        onOk={handleInsuranceConfirm}
        okText="Confirmar"
        cancelText="Cancelar"
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Paragraph>
            A transportadora exige a informação do valor segurado para concluir a seleção.
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
