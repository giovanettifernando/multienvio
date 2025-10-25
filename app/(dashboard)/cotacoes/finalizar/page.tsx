"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Checkbox,
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
          nfeKeys: Array.from({ length: volumesCount }, () => ({ chave: "" })),
          declarationItems: [
            {
              id: crypto.randomUUID(),
              descricao: "",
              valorUnitario: 0,
              quantidade: 1,
            },
          ],
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
          acceptedTerms: false,
        },
        services: {
          avisoRecebimento: false,
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
    formState: { isSubmitting },
  } = formMethods;

  const handleAddToCart: SubmitHandler<FinalizeFormValues> = async (values) => {
    if (!selection || !results || !summary || !selectedService) return;

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
        documento: values.document.type,
        aceitouDeclaracao: values.sender.acceptedTerms,
        valorSeguro: summary.seguroValor,
        avisoRecebimento: values.services.avisoRecebimento,
      };
      await cartAdd.mutateAsync(payload);
      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "ADICIONAR_AO_CARRINHO",
        docType: values.document.type,
      });
      dispatchTelemetry("cart_add", {
        selectionId: selection.selectionId,
      });
      if (
        values.recipient.mode === "manual" &&
        values.recipient.manual.salvarRecorrente
      ) {
        await recipientSave.mutateAsync({
          nome: values.recipient.manual.nome,
          telefone: values.recipient.manual.telefone,
          email: values.recipient.manual.email,
          documento: values.recipient.manual.documento,
          cep: values.recipient.manual.cep,
          logradouro: values.recipient.manual.logradouro,
          numero: values.recipient.manual.numero,
          complemento: values.recipient.manual.complemento,
          bairro: values.recipient.manual.bairro,
          cidade: values.recipient.manual.cidade,
          uf: values.recipient.manual.uf,
          observacoes: values.recipient.manual.observacoes,
        });
      }
      message.success("Cotação adicionada ao carrinho.");
      router.push("/carrinho");
    } catch (error) {
      console.error("Erro ao adicionar ao carrinho", error);
      message.error("Não foi possível adicionar ao carrinho.");
    }
  };

  // Handler simplificado que não depende da validação completa do formulário
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
        aceitouDeclaracao: values.sender?.acceptedTerms ?? false,
        valorSeguro: summary.seguroValor,
        avisoRecebimento: values.services?.avisoRecebimento ?? false,
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
    if (!selection || !results) {
      message.error("Nenhuma seleção de serviço ativa.");
      return;
    }

    try {
      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "PAGAR_AGORA",
        docType: values.document.type,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      const recipientData = values.recipient.manual;
      const trackingCode = `BR${Date.now()}BR`;

      const etaDays = selectedService?.prazoDias ?? 0;
      const expectedDeliveryDate = etaDays
        ? new Date(Date.now() + etaDays * 86_400_000).toISOString()
        : undefined;

      await createShipment.mutateAsync({
        trackingCode,
        recipientName: recipientData.nome,
        recipientCityUf: `${recipientData.cidade}/${recipientData.uf ?? "BR"}`,
        carrierName: selectedService?.carrier ?? "Transportadora",
        serviceName: selectedService?.modalidade ?? "Serviço",
        etaDays,
        expectedDeliveryDate,
        freightValue: selectedService?.preco ?? 0,
        status: "Aguardando coleta",
      });

      await cartClear.mutateAsync();

      if (
        values.recipient.mode === "manual" &&
        values.recipient.manual.salvarRecorrente
      ) {
        await recipientSave.mutateAsync({
          nome: recipientData.nome,
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
          observacoes: recipientData.observacoes,
        });
      }

      dispatchTelemetry("payment_success", {
        selectionId: selection.selectionId,
        codigoRastreio: trackingCode,
      });
      message.success("Pagamento confirmado e envio registrado.");
      router.push("/shipments");
    } catch (error) {
      console.error("Erro ao processar pagamento", error);
      message.error("Não foi possível concluir o pagamento.");
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
                <Controller
                  name="sender.acceptedTerms"
                  control={formMethods.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      validateStatus={fieldState.error ? "error" : undefined}
                      help={fieldState.error?.message}
                    >
                      <Checkbox
                        checked={field.value}
                        onChange={(event) =>
                          field.onChange(event.target.checked)
                        }
                      >
                        Confirmo que li e aceito as regras de embarque da transportadora.
                      </Checkbox>
                    </Form.Item>
                  )}
                />
                <Card title="Serviços adicionais">
                  <Controller
                    name="services.avisoRecebimento"
                    control={formMethods.control}
                    render={({ field }) => (
                      <Checkbox
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                      >
                        Aviso de recebimento
                      </Checkbox>
                    )}
                  />
                </Card>
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
                        onClick={handleSubmit(handlePayNow)}
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
      </form>
    </FormProvider>
  );
}
