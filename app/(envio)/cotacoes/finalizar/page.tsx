"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  App,
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Tooltip,
} from "antd";
import { PageShell } from "@/components/shared/PageShell";
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
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
  createFinalizeFormSchema,
  type FinalizeFormValues,
} from "@/types/quoteFinalize";
import type { DocumentType } from "@/types/quote";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
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
  const { results, selection, clearIfExpired } = useQuoteStore(
    useShallow((state) => ({
      results: state.results,
      selection: state.selection,
      clearIfExpired: state.clearIfExpired,
    })),
  );
  const pickupAtOrigin = useQuoteDraft((s) => s.pickupAtOrigin);
  const destino = useQuoteDraft((s) => s.destination);
  const setDestination = useQuoteDraft((s) => s.setDestination);
  const pickupPointId = useCheckoutStore((s) => s.pickupPointId);
  const cartAdd = useCartAdd();
  const recipientSave = useRecipientSave();

  // Verificar e limpar cotação expirada ao montar o componente
  useEffect(() => {
    const wasExpired = clearIfExpired();
    if (wasExpired) {
      message.warning("Sua cotação expirou. Por favor, faça uma nova cotação.");
      router.push("/cotacoes");
    }
  }, [clearIfExpired, message, router]);

  // Estados para o modal de checkout
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [createdShipment, setCreatedShipment] = useState<{
    id: string;
    trackingCode: string;
    totalAmount: number;
  } | null>(null);

  // Estado adicional para evitar múltiplos cliques
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  const summary = results?.resumo ?? null;
  const selectedService = selection?.result ?? null;
  const initialDoc = (searchParams.get("doc") as DocumentType) ?? selection?.documento ?? "DECLARACAO";

  // Log inicial para debug
  console.log('[FINALIZAR_DEBUG] Initial state:', JSON.stringify({
    pickupAtOrigin,
    hasOrigemCep: !!summary?.origemCep,
    origemCep: summary?.origemCep,
    hasPreco: !!selectedService?.preco,
    preco: selectedService?.preco,
    destino,
    hasDestino: !!destino,
    destinoMode: destino?.mode,
    destinoRecipientId: destino?.recipientId,
    destinoCep: destino?.cep,
    summaryDestinoCep: summary?.destinoCep,
  }, null, 2));

  // Calcular taxa de coleta se pickupAtOrigin estiver ativo
  // Hook params: (originCep, freightCost, enabled)
  const { data: pickupFeeData, isLoading: isLoadingPickupFee, error: pickupFeeError } = usePickupFee(
    summary?.origemCep ?? null,
    selectedService?.preco ?? null,
    pickupAtOrigin  // enabled only when pickup is requested
  );

  // Debug: Log pickup fee data
  useEffect(() => {
    console.log('[PICKUP_FEE_DEBUG] State changed:', JSON.stringify({
      pickupAtOrigin,
      originCep: summary?.origemCep,
      freightCost: selectedService?.preco,
      isLoading: isLoadingPickupFee,
      hasData: !!pickupFeeData,
      pickupFeeData,
      error: pickupFeeError ? String(pickupFeeError) : null,
    }, null, 2));
  }, [pickupAtOrigin, summary?.origemCep, selectedService?.preco, isLoadingPickupFee, pickupFeeData, pickupFeeError]);

  // Inicializar destination se estiver vazio mas houver CEP no summary
  // Isso só deve acontecer quando o usuário usou modo manual (sem destinatário recorrente)
  useEffect(() => {
    if (!destino && summary?.destinoCep) {
      console.log('[FINALIZAR] Inicializando destination com dados do summary (modo manual)');
      setDestination({
        mode: "manual",
        cep: summary.destinoCep,
        city: summary.destinoCidade,
        state: summary.destinoUf,
      });
    }
    // Não sobrescrever se destino já existe (pode ser recipient mode)
  }, [destino, summary, setDestination]);

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
              descricao: "", // Vazio para forçar preenchimento
              valorUnitario: 0,
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
          // Se há um destinatário recorrente selecionado, usar mode: "saved"
          mode: (destino?.mode === "recipient" && destino?.recipientId) ? "saved" : "manual",
          savedId: (destino?.mode === "recipient" && destino?.recipientId) ? destino.recipientId : undefined,
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
    [initialDoc, summary?.destinoCep, summary?.destinoCidade, summary?.destinoUf, summary?.volumes?.length, destino?.mode, destino?.recipientId],
  );

  const formMethods = useForm<FinalizeFormValues>({
    resolver: zodResolver<FinalizeFormValues, unknown, FinalizeFormValues>(
      createFinalizeFormSchema(pickupAtOrigin),
    ),
    defaultValues,
    mode: "onChange",
  });

  const {
    control,
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

  // Watch document fields to validate items
  // Using useWatch for better reactivity with nested fields
  const documentType = useWatch({ control, name: "document.type" });
  const declarationItems = useWatch({ control, name: "document.declarationItems" });
  const volumeDeclarations = useWatch({ control, name: "document.volumeDeclarations" });
  const nfePackages = useWatch({ control, name: "document.packages" });
  const nfeItems = useWatch({ control, name: "document.nfeItems" });

  // Helper: verificar se há pelo menos 1 item válido no documento
  const hasAtLeastOneDocumentItem = useMemo(() => {
    let hasContentItems = false;
    let hasInvoiceItems = false;

    if (documentType === "DECLARACAO") {
      // Formato novo: volumeDeclarations (por volume)
      if (volumeDeclarations && Array.isArray(volumeDeclarations)) {
        hasContentItems = volumeDeclarations.some((volDecl) =>
          volDecl.items && Array.isArray(volDecl.items) && volDecl.items.length > 0 &&
          volDecl.items.some((item) => item.descricao && item.descricao.trim().length > 0)
        );
      }
      // Formato legado: declarationItems (lista única)
      if (!hasContentItems && declarationItems && Array.isArray(declarationItems)) {
        hasContentItems = declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0);
      }

      console.log('[DEBUG DOC ITEMS - DECLARACAO]', {
        documentType,
        hasContentItems,
        volumeDeclarationsCount: volumeDeclarations?.length ?? 0,
        volumeDeclarationsDetails: volumeDeclarations?.map((volDecl, idx) => ({
          volumeIndex: idx,
          itemsCount: volDecl.items?.length ?? 0,
          items: volDecl.items?.map(item => ({
            descricao: item.descricao,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario,
            isEmpty: !item.descricao || item.descricao.trim().length === 0,
          })),
        })),
        declarationItemsCount: declarationItems?.length ?? 0,
        declarationItemsDetails: declarationItems?.map(item => ({
          descricao: item.descricao,
          isEmpty: !item.descricao || item.descricao.trim().length === 0,
        })),
      });

      return hasContentItems;
    } else if (documentType === "NFE") {
      // Formato novo: packages (NF por pacote)
      if (nfePackages && Array.isArray(nfePackages)) {
        hasInvoiceItems = nfePackages.some((pkg) =>
          pkg.items && Array.isArray(pkg.items) && pkg.items.length > 0
        );
      }
      // Formato legado: nfeItems (lista única)
      if (!hasInvoiceItems && nfeItems && Array.isArray(nfeItems)) {
        hasInvoiceItems = nfeItems.length > 0;
      }

      console.log('[DEBUG DOC ITEMS - NFE]', {
        documentType,
        hasInvoiceItems,
        nfePackagesCount: nfePackages?.length ?? 0,
        nfeItemsCount: nfeItems?.length ?? 0,
      });

      return hasInvoiceItems;
    }

    console.log('[DEBUG DOC ITEMS - NONE]', {
      documentType,
      hasContentItems: false,
      hasInvoiceItems: false,
    });

    return false;
  }, [documentType, declarationItems, volumeDeclarations, nfePackages, nfeItems]);

  // Debug: log whenever hasAtLeastOneDocumentItem changes
  useEffect(() => {
    console.log('[DEBUG DOC ITEMS - FINAL]', {
      hasAtLeastOneDocumentItem,
      documentType,
    });
  }, [hasAtLeastOneDocumentItem, documentType]);

  // Pré-condições para habilitar botão "Pagar agora"
  const preconditionsOk = useMemo(() => {
    const checks = {
      selection: !!selection,
      results: !!results,
      summary: !!summary,
      volumes: !!(summary?.volumes && summary.volumes.length > 0),
      pickupPoint: pickupAtOrigin || !!pickupPointId,
      documentItems: hasAtLeastOneDocumentItem,
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
    if (!checks.documentItems) return false;
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
    hasAtLeastOneDocumentItem,
  ]);

  // Mensagem de tooltip para botões desabilitados
  const disabledTooltip = useMemo(() => {
    if (preconditionsOk) return "";

    if (!hasAtLeastOneDocumentItem) {
      return "Informe ao menos um item no documento do envio (Declaração de conteúdo ou Nota Fiscal).";
    }

    if (!pickupAtOrigin && !pickupPointId) {
      return "Selecione um ponto de coleta ou ative a opção de coleta na origem.";
    }

    // Verificar dados do destinatário
    // Alinhado com a lógica de /cotacoes: destinatário é válido se:
    // - há um destinatário recorrente selecionado OU
    // - há CEP de destino válido (modo manual)
    const hasRecurringRecipient = destino?.mode === "recipient" && !!destino.recipientId;
    const hasManualDestination = !!summary?.destinoCep && summary.destinoCep.length > 0;

    // Para finalizar, além do CEP, precisamos dos dados completos do destinatário
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

    console.log('[RECIPIENT_VALIDATION]', {
      hasRecurringRecipient,
      hasManualDestination,
      isRecipientFormValid,
      recipientMode,
      destino,
      recipientNome,
      recipientCep,
      recipientCidade,
      recipientUf,
    });

    // Validação: precisa ter destinatário recorrente OU formulário completo
    // (não basta apenas CEP para finalizar, diferente da cotação)
    if (!hasRecurringRecipient && !isRecipientFormValid) {
      return "Informe os dados obrigatórios do destinatário para continuar.";
    }

    return "Preencha todos os campos obrigatórios para continuar.";
  }, [
    preconditionsOk,
    hasAtLeastOneDocumentItem,
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
    summary?.destinoCep,
  ]);

  // Handler que não depende da validação completa do formulário
  const onAddToCartClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Verificar se a cotação expirou antes de adicionar ao carrinho
    const wasExpired = clearIfExpired();
    if (wasExpired) {
      message.warning("Sua cotação expirou. Por favor, faça uma nova cotação.");
      router.push("/cotacoes");
      return;
    }

    if (!selection || !results || !summary || !selectedService) {
      message.warning("Informações da cotação incompletas.");
      return;
    }

    // Busca valores mínimos necessários para adicionar ao carrinho
    const values = formMethods.getValues();

    // Calcular total incluindo taxa de coleta se aplicável
    const pickupFeeAmount = pickupFeeData && pickupFeeData.success ? pickupFeeData.feeAmount : 0;
    const totalAmount = selectedService.preco + pickupFeeAmount;

    try {
      // Obter dados do destinatário (manual ou salvo)
      let recipientData: typeof values.recipient.manual | undefined;

      if (values.recipient.mode === 'manual') {
        recipientData = values.recipient.manual;
      } else if (values.recipient.mode === 'saved' && values.recipient.savedId) {
        // Buscar destinatário salvo via API
        try {
          console.log('[CART_ADD] Buscando destinatário salvo:', values.recipient.savedId);
          const response = await fetch(`/api/account/recipients/${values.recipient.savedId}`);

          if (!response.ok) {
            message.error('Erro ao buscar dados do destinatário selecionado.');
            return;
          }

          const result = await response.json();
          const recipient = result.data;

          // Mapear dados do destinatário recorrente
          recipientData = {
            nome: recipient.name,
            telefone: recipient.phone || '',
            email: recipient.email || undefined,
            documento: recipient.document || '',
            cep: recipient.cep,
            logradouro: recipient.logradouro,
            numero: recipient.numero,
            complemento: recipient.complemento || '',
            bairro: recipient.bairro,
            cidade: recipient.cidade,
            uf: recipient.uf,
            observacoes: recipient.notes || undefined,
            salvarRecorrente: false, // Não salvar novamente
          };

          // Validar dados mínimos do destinatário salvo
          if (!recipientData.cidade || !recipientData.uf || !recipientData.cep) {
            console.log('[CART_ADD] ERRO: Destinatário salvo com dados incompletos', {
              cidade: recipientData.cidade,
              uf: recipientData.uf,
              cep: recipientData.cep,
            });
            message.error('Destinatário selecionado possui dados incompletos. Por favor, atualize o cadastro.');
            return;
          }

          console.log('[CART_ADD] Destinatário carregado:', recipientData.nome);
        } catch (error) {
          console.error('[CART_ADD] Erro ao buscar destinatário:', error);
          message.error('Erro ao buscar dados do destinatário.');
          return;
        }
      } else {
        message.error('Selecione ou preencha os dados do destinatário.');
        return;
      }

      // Salvar destinatário recorrente se a flag estiver marcada (apenas modo manual)
      if (values.recipient.mode === 'manual' && values.recipient.manual?.salvarRecorrente) {
        try {
          console.log('[CART_ADD] Salvando destinatário recorrente...');
          await recipientSave.mutateAsync({
            nome: recipientData!.nome || '',
            email: recipientData!.email,
            telefone: recipientData!.telefone || '',
            documento: recipientData!.documento || '',
            cep: summary.destinoCep,
            logradouro: recipientData!.logradouro || '',
            numero: recipientData!.numero || '',
            complemento: recipientData!.complemento,
            bairro: recipientData!.bairro || '',
            cidade: summary.destinoCidade || '',
            uf: summary.destinoUf || '',
            observacoes: recipientData!.observacoes,
          });
          console.log('[CART_ADD] Destinatário salvo com sucesso');
          message.success('Destinatário salvo com sucesso!');
        } catch (error) {
          console.error('[CART_ADD] Erro ao salvar destinatário:', error);
          // Não bloquear a adição ao carrinho se o salvamento falhar
          message.warning('Cotação adicionada, mas não foi possível salvar o destinatário.');
        }
      }

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
    // Proteção contra múltiplos cliques
    if (isProcessingCheckout) {
      console.log('[HANDLE_PAY_NOW] ⚠️ Checkout já está em progresso, ignorando clique duplicado');
      return;
    }

    // Verificar se a cotação expirou antes de processar pagamento
    const wasExpired = clearIfExpired();
    if (wasExpired) {
      message.warning("Sua cotação expirou. Por favor, faça uma nova cotação.");
      router.push("/cotacoes");
      return;
    }

    setIsProcessingCheckout(true);
    console.log('[HANDLE_PAY_NOW] 🔒 Iniciando checkout (lock ativado)', { selection, results: !!results, summary: !!summary, selectedService: !!selectedService });

    try {
      console.log('[DEBUG_CHECKPOINT_1] Antes do if de validação');

      if (!selection || !results || !summary || !selectedService) {
        console.log('[DEBUG_CHECKPOINT_2] ENTRANDO no if - falta dados!', {
          selection: !!selection,
          results: !!results,
          summary: !!summary,
          selectedService: !!selectedService,
        });
        message.error("Nenhuma seleção de serviço ativa.");
        return;
      }

      console.log('[DEBUG_CHECKPOINT_3] Passou pelo if de validação!');

    // Determinar dados do destinatário
    let recipientData: FinalizeFormValues['recipient']['manual'] | undefined;

    console.log('[DEBUG_CHECKPOINT_4] Declarou recipientData');

    console.log('[RECIPIENT_DEBUG] values.recipient:', JSON.stringify(values.recipient, null, 2));
    console.log('[RECIPIENT_DEBUG] values.recipient.mode:', values.recipient.mode);
    console.log('[RECIPIENT_DEBUG] destino:', destino);

    if (values.recipient.mode === "manual") {
      console.log('[RECIPIENT_DEBUG] Modo MANUAL detectado');
      recipientData = values.recipient.manual;
      console.log('[RECIPIENT_DEBUG] recipientData copiado:', JSON.stringify(recipientData, null, 2));

      // Validar dados mínimos do destinatário manual
      if (!recipientData?.cidade || !recipientData?.uf || !recipientData?.cep) {
        console.log('[RECIPIENT_DEBUG] ERRO: Dados incompletos', {
          cidade: recipientData?.cidade,
          uf: recipientData?.uf,
          cep: recipientData?.cep,
        });
        message.error("Dados do destinatário incompletos. Informe ao menos CEP, cidade e UF.");
        return;
      }
      console.log('[RECIPIENT_DEBUG] Validação MANUAL passou!');
    } else if (values.recipient.mode === "saved" && values.recipient.savedId) {
      console.log('[RECIPIENT_DEBUG] Modo SAVED detectado');
      // Buscar destinatário salvo via API
      try {
        const response = await fetch(`/api/account/recipients/${values.recipient.savedId}`);

        if (!response.ok) {
          console.log('[RECIPIENT_DEBUG] ERRO: Falha ao buscar destinatário');
          message.error("Erro ao buscar dados do destinatário selecionado.");
          return;
        }

        const result = await response.json();
        const recipient = result.data;

        // Mapear dados do destinatário recorrente
        recipientData = {
          nome: recipient.name,
          telefone: recipient.phone || '',
          email: recipient.email || undefined,
          documento: recipient.document || '',
          cep: recipient.cep,
          logradouro: recipient.logradouro,
          numero: recipient.numero,
          complemento: recipient.complemento || '',
          bairro: recipient.bairro,
          cidade: recipient.cidade,
          uf: recipient.uf,
          observacoes: recipient.notes || undefined,
          salvarRecorrente: false, // Não salvar novamente
        };

        // Validar dados mínimos do destinatário salvo
        if (!recipientData.cidade || !recipientData.uf || !recipientData.cep) {
          console.log('[RECIPIENT_DEBUG] ERRO: Destinatário salvo com dados incompletos', {
            cidade: recipientData.cidade,
            uf: recipientData.uf,
            cep: recipientData.cep,
          });
          message.error("Destinatário selecionado possui dados incompletos. Por favor, atualize o cadastro.");
          return;
        }

        console.log('[RECIPIENT_DEBUG] Destinatário carregado:', recipientData.nome);
      } catch (error) {
        console.error('[RECIPIENT_DEBUG] Exceção ao buscar destinatário:', error);
        message.error("Erro ao buscar dados do destinatário.");
        return;
      }
    } else {
      console.log('[RECIPIENT_DEBUG] ERRO: Modo desconhecido ou não implementado', {
        mode: values.recipient.mode,
        savedId: values.recipient.savedId,
      });
      message.error("Selecione ou preencha os dados do destinatário.");
      return;
    }

    console.log('[RECIPIENT_DEBUG] recipientData final:', JSON.stringify(recipientData, null, 2));

    // Salvar destinatário recorrente se a flag estiver marcada (apenas para modo manual)
    if (values.recipient.mode === 'manual' && values.recipient.manual?.salvarRecorrente && recipientData) {
      try {
        console.log('[CHECKOUT] Salvando destinatário recorrente...');
        await recipientSave.mutateAsync({
          nome: recipientData.nome || '',
          email: recipientData.email,
          telefone: recipientData.telefone || '',
          documento: recipientData.documento || '',
          cep: recipientData.cep || '',
          logradouro: recipientData.logradouro || '',
          numero: recipientData.numero || '',
          complemento: recipientData.complemento,
          bairro: recipientData.bairro || '',
          cidade: recipientData.cidade || '',
          uf: recipientData.uf || '',
          observacoes: recipientData.observacoes,
        });
        console.log('[CHECKOUT] Destinatário salvo com sucesso');
        message.success('Destinatário salvo com sucesso!');
      } catch (error) {
        console.error('[CHECKOUT] Erro ao salvar destinatário:', error);
        // Não bloquear o checkout se o salvamento falhar
        message.warning('Continuando checkout, mas não foi possível salvar o destinatário.');
      }
    }

    // Validar pickup point se não houver coleta na origem
    if (!pickupAtOrigin && !pickupPointId) {
      message.error("Selecione um ponto de coleta ou ative a opção de coleta na origem.");
      return;
    }

      // Calcular total incluindo taxa de coleta se aplicável
      const pickupFeeAmount = pickupFeeData && pickupFeeData.success ? pickupFeeData.feeAmount : 0;
      const totalAmount = selectedService.preco + pickupFeeAmount;

      dispatchTelemetry("quote_finalize_submit", {
        selectionId: selection.selectionId,
        action: "PAGAR_AGORA",
        docType: values.document.type,
        hasPickupFee: pickupFeeAmount > 0,
      });

      // Montar payload do checkout
      console.log('[CHECKOUT_FRONTEND] recipientData.salvarRecorrente:', recipientData.salvarRecorrente);
      console.log('[CHECKOUT_FRONTEND] recipientData completo:', recipientData);

      const payload = {
        quoteId: selection.selectionId,
        recipient: {
          nome: recipientData.nome || "",
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
          salvarRecorrente: recipientData.salvarRecorrente || false,
        },
        document: {
          type: values.document.type,
          // Novo formato: NF por pacote
          packages: values.document.type === "NFE" ? values.document.packages : undefined,
          // Campos legados para retrocompatibilidade
          nfeKeys: values.document.type === "NFE" ? values.document.nfeKeys : undefined,
          nfeItems: values.document.type === "NFE" ? values.document.nfeItems : undefined,
          declarationItems: values.document.type === "DECLARACAO" ? values.document.declarationItems : undefined,
          // Novo formato: declaração por volume
          volumeDeclarations: values.document.type === "DECLARACAO" ? values.document.volumeDeclarations : undefined,
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

      console.log('[CHECKOUT_FRONTEND] Payload completo sendo enviado:', JSON.stringify(payload, null, 2));
      console.log('[CHECKOUT_FRONTEND] payload.recipient.salvarRecorrente:', payload.recipient.salvarRecorrente);

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
    } finally {
      // Sempre desbloquear no final, independente de sucesso ou erro
      setIsProcessingCheckout(false);
      console.log('[HANDLE_PAY_NOW] 🔓 Checkout finalizado (lock liberado)');
    }
  };

  if (!results || !selection) {
    return (
      <PageShell title="Finalizar Envio" gap="md">
        <Skeleton active />
      </PageShell>
    );
  }

  return (
    <PageShell title="Finalizar Envio" gap="md">
      <FormProvider {...formMethods}>
        <form>
          {/* Resumo do envio, serviço e pagamento lado a lado no topo */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={10}>
              <ResultsBanner summary={summary!} />
            </Col>
            <Col xs={24} md={12} xl={8}>
              <LabelPreview
                carrier={selectedService?.carrier ?? ""}
                modalidade={selectedService?.modalidade ?? ""}
                prazoDias={selectedService?.prazoDias ?? 0}
                preco={selectedService?.preco ?? 0}
                isLoadingPickupFee={pickupAtOrigin && isLoadingPickupFee}
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
            </Col>
            <Col xs={24} md={24} xl={6}>
              <Card
                size="small"
                title="Pagamento"
                styles={{ body: { padding: "12px 16px" } }}
              >
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Tooltip title={disabledTooltip}>
                    <Button
                      type="default"
                      htmlType="button"
                      block
                      size="small"
                      loading={cartAdd.isPending}
                      disabled={!selectedService || !preconditionsOk}
                      onClick={onAddToCartClick}
                    >
                      Adicionar ao carrinho
                    </Button>
                  </Tooltip>
                  <Tooltip title={disabledTooltip}>
                    <Button
                      type="primary"
                      htmlType="button"
                      block
                      size="small"
                      loading={isSubmitting || isProcessingCheckout}
                      disabled={isSubmitting || isProcessingCheckout || !preconditionsOk}
                      onClick={(e) => {
                        console.log('[BUTTON_CLICK]', {
                          isSubmitting,
                          isProcessingCheckout,
                          preconditionsOk,
                          disabled: isSubmitting || isProcessingCheckout || !preconditionsOk,
                          formErrors: errors
                        });
                        handleSubmit(
                          handlePayNow,
                          (validationErrors) => {
                            console.log('[FORM_VALIDATION_FAILED]', validationErrors);
                            message.error('Por favor, preencha todos os campos obrigatórios.');
                            setIsProcessingCheckout(false); // Liberar lock em caso de erro de validação
                          }
                        )(e);
                      }}
                    >
                      Pagar agora
                    </Button>
                  </Tooltip>
                </Space>
              </Card>
            </Col>
          </Row>

          {/* Formulários */}
          <Space direction="vertical" size={24} style={{ width: "100%", marginTop: 24 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={14}>
                <DocumentChooser />
              </Col>
              <Col xs={24} lg={10}>
                <PostingUnitPicker />
              </Col>
            </Row>
            <RecipientForm />
          </Space>

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
    </PageShell>
  );
}
