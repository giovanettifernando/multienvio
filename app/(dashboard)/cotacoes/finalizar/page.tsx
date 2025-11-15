"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Row,
  Select,
  Skeleton,
  Space,
  Tooltip,
  Typography,
} from "antd";
import {
  Controller,
  FormProvider,
  SubmitHandler,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShallow } from "zustand/react/shallow";
import { DocumentChooser } from "@/components/quote/DocumentChooser";
import { PostingUnitPicker } from "@/components/quote/PostingUnitPicker";
import { RecipientForm } from "@/components/quote/RecipientForm";
import { LabelPreview } from "@/components/quote/LabelPreview";
import { ResultsBanner } from "@/components/quote/ResultsBanner";
import { QuoteNavigationButtons } from "@/components/quote/QuoteNavigationButtons";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useCartAdd } from "@/hooks/useCart";
import { useRecipientSave } from "@/hooks/useQuotes";
import {
  useShipmentCreate,
  useCartClear as useShipmentsCartClear,
} from "@/hooks/useShipments";
import {
  createFinalizeFormSchema,
  type FinalizeFormValues,
} from "@/types/quoteFinalize";
import type { DocumentType } from "@/types/quote";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { executeCheckout } from "@/lib/checkout/orchestrator";
import { useCheckoutStore } from "@/stores/checkout";
import { CheckoutModal } from "@/components/payments/CheckoutModal";
import { usePickupFee } from "@/hooks/usePickupFee";

const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

export default function FinalizeQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { results, selection } = useQuoteStore(
    useShallow((state) => ({
      results: state.results,
      selection: state.selection,
    })),
  );
  const pickupAtOrigin = useQuoteDraft((s) => s.pickupAtOrigin);
  const pickupPointId = useCheckoutStore((s) => s.pickupPointId);
  const cartAdd = useCartAdd();
  const recipientSave = useRecipientSave();
  const createShipment = useShipmentCreate();
  const cartClear = useShipmentsCartClear();

  // Estados para o modal de checkout
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [createdShipment, setCreatedShipment] = useState<{
    id: string;
    trackingCode: string;
    totalAmount: number;
  } | null>(null);

  const summary = results?.resumo ?? null;
  const selectedService = selection?.result ?? null;
  const initialDoc = (searchParams.get("doc") as DocumentType) ?? selection?.documento ?? "DECLARACAO";

  // Calcular taxa de coleta se pickupAtOrigin estiver ativo
  const { data: pickupFeeData } = usePickupFee(
    pickupAtOrigin ? summary?.origemCep : null,
    pickupAtOrigin ? selectedService?.preco : null,
    pickupAtOrigin
  );

  useEffect(() => {
    if (!results || !selection) {
      message.warning("Selecione uma cotação para continuar.");
      router.replace("/cotacoes");
    }
  }, [results, router, selection, message]);

  const defaultValues: FinalizeFormValues = useMemo(
    () => {
      const volumesCount = summary?.volumes?.length ?? 1;
      return {
        document: {
          type: initialDoc,
          nfeKey: "",
          nfeXml: null,
          // Novo formato: NF por pacote
          packages: initialDoc === "NFE" ? Array.from({ length: volumesCount }, () => ({
            chave: "",
            xmlId: null,
            items: [],
          })) : undefined,
          // Campos legados
          nfeKeys: initialDoc === "NFE" ? Array.from({ length: volumesCount }, () => ({ chave: "" })) : undefined,
          declarationItems: initialDoc === "DECLARACAO" ? [
            {
              id: crypto.randomUUID(),
              descricao: "Produto",
              valorUnitario: 100,
              quantidade: 1,
            },
          ] : undefined,
          // Novo formato: declaração por volume
          volumeDeclarations: initialDoc === "DECLARACAO" ? Array.from({ length: volumesCount }, (_, idx) => ({
            volumeIndex: idx,
            items: [
              {
                id: crypto.randomUUID(),
                descricao: "",
                valorUnitario: 0,
                quantidade: 1,
              },
            ],
          })) : undefined,
        },
        postingUnit: {
          selected: null,
          ampliarBusca: false,
          incluirEstadosProximos: false,
          definirComoPadrao: false,
        },
        recipient: {
          mode: "manual",
          savedId: undefined,
          manual: {
            nome: "",
            telefone: "",
            email: "",
            documento: "",
            cep: summary?.destinoCep ?? "",
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: summary?.destinoCidade ?? "",
            uf: summary?.destinoUf ?? "",
            observacoes: "",
            salvarRecorrente: false,
          },
        },
        sender: {
          addressId: "",
        },
      };
    },
    [initialDoc, summary?.destinoCep, summary?.destinoCidade, summary?.destinoUf, summary?.volumes?.length],
  );

  const formMethods = useForm<FinalizeFormValues>({
    resolver: zodResolver<FinalizeFormValues, unknown, FinalizeFormValues>(
      createFinalizeFormSchema(pickupAtOrigin),
    ),
    defaultValues,
    mode: "onChange",
  });

  const {
    handleSubmit,
    formState: { isSubmitting, errors, dirtyFields, touchedFields },
    watch,
    getValues,
  } = formMethods;

  // Debug: log form errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('[FORM_ERRORS]', errors);
    }
  }, [errors]);

  // Watch destination mode and manual fields for validation
  const destino = useQuoteDraft((s) => s.destination);

  // Watch all recipient fields to trigger re-validation
  const recipientMode = watch("recipient.mode");
  const recipientNome = watch("recipient.manual.nome");
  const recipientTelefone = watch("recipient.manual.telefone");
  const recipientEmail = watch("recipient.manual.email");
  const recipientDocumento = watch("recipient.manual.documento");
  const recipientNumero = watch("recipient.manual.numero");
  const recipientCep = watch("recipient.manual.cep");
  const recipientLogradouro = watch("recipient.manual.logradouro");
  const recipientBairro = watch("recipient.manual.bairro");
  const recipientCidade = watch("recipient.manual.cidade");
  const recipientUf = watch("recipient.manual.uf");

  // Pré-condições para habilitar botão "Pagar agora"
  const preconditionsOk = useMemo(() => {
    const checks = {
      selection: !!selection,
      results: !!results,
      summary: !!summary,
      volumes: !!(summary?.volumes && summary.volumes.length > 0),
      pickupPoint: pickupAtOrigin || !!pickupPointId,
    };

    // Check if recipient is valid
    const hasRecurringRecipient = destino?.mode === "recipient" && !!destino.recipientId;

    // Check manual recipient validity
    const isRecipientFormValid =
      recipientMode === "manual" &&
      !!recipientNome && recipientNome.trim().length > 0 &&
      !!recipientTelefone && recipientTelefone.trim().length > 0 &&
      !!recipientEmail && recipientEmail.trim().length > 0 &&
      !!recipientDocumento && recipientDocumento.trim().length > 0 &&
      !!recipientNumero && recipientNumero.trim().length > 0 &&
      !!recipientCep && recipientCep.trim().length > 0 &&
      !!recipientLogradouro && recipientLogradouro.trim().length > 0 &&
      !!recipientBairro && recipientBairro.trim().length > 0 &&
      !!recipientCidade && recipientCidade.trim().length > 0 &&
      !!recipientUf && recipientUf.trim().length > 0;

    const canProceed = hasRecurringRecipient || isRecipientFormValid;

    console.log('[PRECONDITIONS]', {
      ...checks,
      hasRecurringRecipient,
      isRecipientFormValid,
      canProceed,
      recipientMode,
      fields: {
        nome: recipientNome,
        telefone: recipientTelefone,
        email: recipientEmail,
        documento: recipientDocumento,
        numero: recipientNumero,
        cep: recipientCep,
        logradouro: recipientLogradouro,
        bairro: recipientBairro,
        cidade: recipientCidade,
        uf: recipientUf,
      },
    });

    if (!checks.selection || !checks.results || !checks.summary) return false;
    if (!checks.volumes) return false;
    if (!checks.pickupPoint) return false;
    if (!canProceed) return false;

    return true;
  }, [
    selection,
    results,
    summary,
    pickupAtOrigin,
    pickupPointId,
    destino,
    recipientMode,
    recipientNome,
    recipientTelefone,
    recipientEmail,
    recipientDocumento,
    recipientNumero,
    recipientCep,
    recipientLogradouro,
    recipientBairro,
    recipientCidade,
    recipientUf,
  ]);

  // Handler que não depende da validação completa do formulário
  const onAddToCartClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selection || !results || !summary || !selectedService) {
      message.warning("Informações da cotação incompletas.");
      return;
    }

    // Busca valores mínimos necessários para adicionar ao carrinho
    const values = formMethods.getValues();

    // Calculate total weight and cubic weight
    const totalWeight = summary.volumes.reduce((sum, vol) => sum + vol.pesoKg, 0);
    const totalCubicWeight = summary.volumes.reduce((sum, vol) => {
      const cubicWeight = (vol.comprimentoCm * vol.larguraCm * vol.alturaCm) / 6000;
      return sum + cubicWeight;
    }, 0);

    // Calcular total incluindo taxa de coleta se aplicável
    const pickupFeeAmount = pickupFeeData && pickupFeeData.success ? pickupFeeData.feeAmount : 0;
    const totalAmount = selectedService.preco + pickupFeeAmount;

    try {
      // Obter dados do destinatário (manual ou salvo)
      const recipientData = values.recipient.mode === 'manual'
        ? values.recipient.manual
        : null; // TODO: buscar dados do destinatário salvo se necessário

      // Construir payload no novo formato esperado pelo backend
      const payload = {
        originAddress: {
          cep: summary.origemCep,
          logradouro: 'N/A', // QuoteSummary não tem logradouro de origem
          numero: 'S/N',
          bairro: 'N/A',
          cidade: summary.origemCidade || '',
          uf: summary.origemUf || '',
        },
        destination: {
          cep: summary.destinoCep,
          logradouro: recipientData?.logradouro || 'N/A',
          numero: recipientData?.numero || 'S/N',
          bairro: recipientData?.bairro || 'N/A',
          cidade: summary.destinoCidade || '',
          uf: summary.destinoUf || '',
          nome: recipientData?.nome,
          telefone: recipientData?.telefone,
          email: recipientData?.email,
          documento: recipientData?.documento,
          complemento: recipientData?.complemento,
        },
        volumes: summary.volumes,
        preferences: {
          pickupRequested: pickupAtOrigin,
          reverse: summary.devolucao || false,
        },
        insuranceValue: summary.seguroValor || undefined,
        pickupPoint: pickupPointId ? { id: pickupPointId } : undefined,
        pickupFee: pickupFeeData && pickupFeeData.success ? {
          collectorId: pickupFeeData.collector.id,
          feeAmount: pickupFeeData.feeAmount,
          distanceKm: pickupFeeData.distanceKm,
        } : undefined,
        selectedQuote: {
          carrier: selectedService.carrier,
          serviceCode: selectedService.modalidade,
          serviceName: selectedService.modalidade,
          price: selectedService.preco,
          deadlineDays: selectedService.prazoDias,
          source: 'mock' as const,
        },
        totals: {
          total: totalAmount,
          subtotal: selectedService.preco,
          pickupFee: pickupFeeAmount,
          moeda: 'BRL',
        },
      };

      await cartAdd.mutateAsync(payload);

      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "ADICIONAR_AO_CARRINHO",
        docType: values.document?.type ?? "DECLARACAO",
        hasPickupFee: pickupFeeAmount > 0,
      });
      dispatchTelemetry("cart_add", {
        selectionId: selection.selectionId,
      });

      message.success("Cotação adicionada ao carrinho.");
      router.push("/carrinho");
    } catch (error) {
      console.error("Erro ao adicionar ao carrinho", error);
      message.error("Não foi possível adicionar ao carrinho.");
    }
  };

  const handlePayNow: SubmitHandler<FinalizeFormValues> = async (values) => {
    console.log('[HANDLE_PAY_NOW] Iniciando checkout', { selection, results: !!results, summary: !!summary, selectedService: !!selectedService });

    if (!selection || !results || !summary || !selectedService) {
      message.error("Nenhuma seleção de serviço ativa.");
      return;
    }

    // Determinar dados do destinatário
    let recipientData: FinalizeFormValues['recipient']['manual'] | undefined;

    if (values.recipient.mode === "manual") {
      recipientData = values.recipient.manual;

      // Validar dados mínimos do destinatário manual
      if (!recipientData?.cidade || !recipientData?.uf || !recipientData?.cep) {
        message.error("Dados do destinatário incompletos. Informe ao menos CEP, cidade e UF.");
        return;
      }
    } else if (values.recipient.mode === "saved" && values.recipient.savedId) {
      // Buscar destinatário salvo (TODO: implementar API para buscar)
      // Por enquanto, usar dados do summary
      if (!summary.destinoCidade || !summary.destinoUf) {
        message.error("Dados de destino incompletos.");
        return;
      }
      recipientData = {
        nome: "Destinatário Salvo",
        cep: summary.destinoCep,
        cidade: summary.destinoCidade,
        uf: summary.destinoUf,
        salvarRecorrente: false,
      };
    } else {
      message.error("Selecione ou preencha os dados do destinatário.");
      return;
    }

    // Validar pickup point se não houver coleta na origem
    if (!pickupAtOrigin && !pickupPointId) {
      message.error("Selecione um ponto de coleta ou ative a opção de coleta na origem.");
      return;
    }

    // Calcular total incluindo taxa de coleta se aplicável
    const pickupFeeAmount = pickupFeeData && pickupFeeData.success ? pickupFeeData.feeAmount : 0;
    const totalAmount = selectedService.preco + pickupFeeAmount;

    try {
      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "PAGAR_AGORA",
        docType: values.document.type,
        hasPickupFee: pickupFeeAmount > 0,
      });

      // Montar payload do checkout
      const payload = {
        quoteId: selection.selectionId,
        recipient: {
          nome: recipientData.nome || "Cliente",
          telefone: recipientData.telefone,
          email: recipientData.email,
          documento: recipientData.documento,
          cep: recipientData.cep,
          logradouro: recipientData.logradouro,
          numero: recipientData.numero,
          complemento: recipientData.complemento,
          bairro: recipientData.bairro,
          cidade: recipientData.cidade,
          uf: recipientData.uf,
        },
        document: {
          type: values.document.type,
          // Novo formato: NF por pacote
          packages: values.document.type === "NFE" ? values.document.packages : undefined,
          // Campos legados para retrocompatibilidade
          nfeKeys: values.document.type === "NFE" ? values.document.nfeKeys : undefined,
          nfeItems: values.document.type === "NFE" ? values.document.nfeItems : undefined,
          declarationItems: values.document.type === "DECLARACAO" ? values.document.declarationItems : undefined,
        },
        volumes: summary.volumes.map((v) => ({
          peso: v.pesoKg,
          altura: v.alturaCm,
          largura: v.larguraCm,
          comprimento: v.comprimentoCm,
        })),
        insuranceValue: summary.seguroValor || 0,
        pickupPointId: pickupAtOrigin ? null : pickupPointId,
        pickupFee: pickupFeeData && pickupFeeData.success ? {
          collectorId: pickupFeeData.collector.id,
          feeAmount: pickupFeeData.feeAmount,
          distanceKm: pickupFeeData.distanceKm,
        } : undefined,
        carrier: selectedService.carrier,
        service: selectedService.modalidade,
        originCep: summary.origemCep || "",
        originCidade: summary.origemCidade,
        originUf: summary.origemUf,
        destinationCep: summary.destinoCep || "",
        estimatedDays: selectedService.prazoDias,
        freightCost: selectedService.preco,
        totalCost: totalAmount,
        solicitarColeta: pickupAtOrigin, // Usar pickupAtOrigin do quoteDraft
      };

      // Criar shipment via API
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao processar checkout");
      }

      const out = await res.json();

      // Guardar informações do shipment e abrir modal de pagamento
      setCreatedShipment({
        id: out.shipmentId,
        trackingCode: out.trackingCode,
        totalAmount: totalAmount,
      });
      setCheckoutModalOpen(true);

      dispatchTelemetry("checkout_created", {
        selectionId: selection.selectionId,
        shipmentId: out.shipmentId,
      });
    } catch (error: unknown) {
      console.error("Erro ao processar pagamento", error);
      const errorMessage = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
      message.error(errorMessage);
    }
  };

  if (!results || !selection) {
    return <Skeleton active />;
  }

  return (
    <FormProvider {...formMethods}>
      <form>
        <Flex vertical gap={24}>
          <ResultsBanner summary={summary!} />

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <DocumentChooser />
                <PostingUnitPicker />
                <RecipientForm />
              </Space>
            </Col>
            <Col xs={24} lg={8}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <LabelPreview
                  carrier={selectedService?.carrier ?? ""}
                  modalidade={selectedService?.modalidade ?? ""}
                  prazoDias={selectedService?.prazoDias ?? 0}
                  preco={selectedService?.preco ?? 0}
                  pickupFee={
                    pickupFeeData && pickupFeeData.success
                      ? {
                          collectorName: pickupFeeData.collector.pfNome || pickupFeeData.collector.pjRazaoSocial,
                          distanceKm: pickupFeeData.distanceKm,
                          feeAmount: pickupFeeData.feeAmount,
                        }
                      : null
                  }
                />
                <Card title="Pagamento">
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Tooltip
                        title={!preconditionsOk ? "Informe os dados obrigatórios do destinatário para continuar." : ""}
                      >
                        <Button
                          type="default"
                          htmlType="button"
                          block
                          loading={cartAdd.isPending}
                          disabled={!selectedService || !preconditionsOk}
                          onClick={onAddToCartClick}
                          style={{ width: "100%" }}
                        >
                          Adicionar ao carrinho
                        </Button>
                      </Tooltip>
                      <Tooltip
                        title={!preconditionsOk ? "Informe os dados obrigatórios do destinatário para continuar." : ""}
                      >
                        <Button
                          type="primary"
                          htmlType="button"
                          block
                          loading={isSubmitting}
                          disabled={isSubmitting || !preconditionsOk}
                          onClick={(e) => {
                            console.log('[BUTTON_CLICK]', {
                              isSubmitting,
                              preconditionsOk,
                              disabled: isSubmitting || !preconditionsOk,
                              formErrors: errors
                            });
                            handleSubmit(
                              handlePayNow,
                              (validationErrors) => {
                                console.log('[FORM_VALIDATION_FAILED]', validationErrors);
                                message.error('Por favor, preencha todos os campos obrigatórios.');
                              }
                            )(e);
                          }}
                          style={{ width: "100%" }}
                        >
                          Pagar agora
                        </Button>
                      </Tooltip>
                    </Space>
                    <Typography.Text type="secondary">
                      Após o pagamento, a etiqueta ficará disponível em Meus envios.
                    </Typography.Text>
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </Flex>

        <QuoteNavigationButtons
          onBack={() => router.back()}
          backLabel="Voltar"
        />
      </form>

      {/* Modal de escolha de pagamento */}
      {createdShipment && (
        <CheckoutModal
          open={checkoutModalOpen}
          onClose={() => setCheckoutModalOpen(false)}
          shipmentId={createdShipment.id}
          totalAmount={createdShipment.totalAmount}
          trackingCode={createdShipment.trackingCode}
        />
      )}
    </FormProvider>
  );
}
