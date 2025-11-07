"use client";

import { useEffect, useMemo } from "react";
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

  const summary = results?.resumo ?? null;
  const selectedService = selection?.result ?? null;
  const initialDoc = (searchParams.get("doc") as DocumentType) ?? selection?.documento ?? "DECLARACAO";

  useEffect(() => {
    if (!results || !selection) {
      router.replace("/cotacoes/resultados");
    }
  }, [results, router, selection]);

  const defaultValues: FinalizeFormValues = useMemo(
    () => {
      const volumesCount = summary?.volumes?.length ?? 1;
      return {
        document: {
          type: initialDoc,
          nfeKey: "",
          nfeXml: null,
          nfeKeys: initialDoc === "NFE" ? Array.from({ length: volumesCount }, () => ({ chave: "" })) : undefined,
          declarationItems: initialDoc === "DECLARACAO" ? [
            {
              id: crypto.randomUUID(),
              descricao: "Produto",
              valorUnitario: 100,
              quantidade: 1,
            },
          ] : undefined,
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
        payment: {
          method: "PIX",
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
    formState: { isSubmitting, errors },
    watch,
  } = formMethods;

  // Debug: log form errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('[FORM_ERRORS]', errors);
    }
  }, [errors]);

  // Pré-condições para habilitar botão "Pagar agora"
  const preconditionsOk = useMemo(() => {
    const checks = {
      selection: !!selection,
      results: !!results,
      summary: !!summary,
      volumes: !!(summary?.volumes && summary.volumes.length > 0),
      pickupPoint: pickupAtOrigin || !!pickupPointId,
    };

    console.log('[PRECONDITIONS]', checks, { pickupAtOrigin, pickupPointId });

    if (!checks.selection || !checks.results || !checks.summary) return false;
    if (!checks.volumes) return false;
    if (!checks.pickupPoint) return false;

    return true;
  }, [selection, results, summary, pickupAtOrigin, pickupPointId]);

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

    try {
      const payload = {
        selectionId: selection.selectionId,
        quoteId: results.quoteId,
        transportadora: selectedService.carrier,
        modalidade: selectedService.modalidade,
        prazoEstimadoDias: selectedService.prazoDias,
        preco: selectedService.preco,
        quantidade: 1,
        origem: {
          cep: summary.origemCep,
          cidadeUF: summary.origemCidade && summary.origemUf
            ? `${summary.origemCidade}/${summary.origemUf}`
            : undefined,
        },
        destino: {
          cep: summary.destinoCep,
          cidadeUF: summary.destinoCidade && summary.destinoUf
            ? `${summary.destinoCidade}/${summary.destinoUf}`
            : undefined,
        },
        devolucao: summary.devolucao,
        coleta: summary.coleta,
        volumes: summary.volumes,
        pesoTotalKg: totalWeight,
        pesoCubadoTotalKg: totalCubicWeight,
        documento: values.document?.type ?? "DECLARACAO",
        aceitouDeclaracao: true,
        valorSeguro: summary.seguroValor,
        avisoRecebimento: false,
      };

      await cartAdd.mutateAsync(payload);

      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "ADICIONAR_AO_CARRINHO",
        docType: values.document?.type ?? "DECLARACAO",
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
    let recipientData: any;

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
      recipientData = {
        nome: "Destinatário Salvo",
        cep: summary.destinoCep,
        cidade: summary.destinoCidade,
        uf: summary.destinoUf,
      };
    } else {
      message.error("Selecione ou preencha os dados do destinatário.");
      return;
    }

    // Validar pickup point se não houver coleta na origem
    if (!pickupAtOrigin && !pickupPointId) {
      message.error("Selecione um ponto de coleta.");
      return;
    }

    try {
      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "PAGAR_AGORA",
        docType: values.document.type,
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
          nfeKeys: values.document.type === "NFE" ? values.document.nfeKeys : undefined,
          declarationItems: values.document.type === "DECLARACAO" ? values.document.declarationItems : undefined,
        },
        volumes: summary.volumes.map((v) => ({
          peso: v.pesoKg,
          altura: v.alturaCm,
          largura: v.larguraCm,
          comprimento: v.comprimentoCm,
        })),
        insuranceValue: summary.valorSeguro || 0,
        pickupPointId: pickupAtOrigin ? null : pickupPointId,
        carrier: selectedService.carrier,
        service: selectedService.modalidade,
        originCep: summary.origemCep || "",
        destinationCep: summary.destinoCep || "",
        estimatedDays: selectedService.prazoDias,
        freightCost: selectedService.preco,
        paymentMethod: values.payment.method || "PIX",
      };

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

      // Redirecionar baseado no resultado
      if (out.paymentUrl) {
        // Gateway de pagamento externo
        window.location.href = out.paymentUrl;
      } else if (out.source === 'wallet') {
        // Pagamento via carteira aprovado
        message.success(out.message || "Pagamento aprovado!");
        router.push(`/shipments`);
      } else {
        // Mock ou outros métodos
        message.info(out.message || "Envio criado com sucesso!");
        router.push(`/shipments`);
      }

      dispatchTelemetry("payment_success", {
        selectionId: selection.selectionId,
        shipmentId: out.shipmentId,
        source: out.source,
      });
    } catch (error: any) {
      console.error("Erro ao processar pagamento", error);
      message.error(error?.message ?? "Não foi possível iniciar o pagamento.");
    }
  };

  if (!results || !selection) {
    return <Skeleton active />;
  }

  return (
    <FormProvider {...formMethods}>
      <form>
        <Flex vertical gap={24}>
          <ResultsBanner
            summary={summary!}
            onEditVolumes={() => router.push("/cotacoes")}
            onEditReminder={() => {}}
            onRemoveReminder={() => {}}
          />

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
                  lembrete={summary?.lembrete ?? null}
                />
                <Card title="Pagamento">
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    <Controller
                      name="payment.method"
                      control={formMethods.control}
                      render={({ field }) => (
                        <Form.Item label="Método preferencial">
                          <Select
                            value={field.value}
                            options={[
                              { value: "WALLET", label: "Saldo em carteira" },
                              { value: "PIX", label: "PIX" },
                              { value: "CARD", label: "Cartão de crédito" },
                              { value: "BOLETO", label: "Boleto" },
                            ]}
                            onChange={field.onChange}
                          />
                        </Form.Item>
                      )}
                    />
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Button
                        type="default"
                        htmlType="button"
                        block
                        loading={cartAdd.isPending}
                        disabled={!selectedService}
                        onClick={onAddToCartClick}
                      >
                        Adicionar ao carrinho
                      </Button>
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
                      >
                        Pagar agora
                      </Button>
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
          onBack={() => router.push("/cotacoes/resultados")}
          backLabel="Ver outros serviços"
        />
      </form>
    </FormProvider>
  );
}
