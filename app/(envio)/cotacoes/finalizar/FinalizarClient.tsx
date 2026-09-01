"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ELTypography, ELSpace, useELApp, ELDivider, ELTooltip } from '@/shared/ui';
const Divider = ELDivider;
const Tooltip = ELTooltip;
const Typography = ELTypography;
const Space = ELSpace;
const App = { useApp: useELApp };
import { EditOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELCard } from '@/shared/ui/ELCard';
import { ELGrid } from '@/shared/ui/ELGrid';
import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import { PageShell } from '@/shared/ui/PageShell';
import { useProfile } from "@/modules/account/ui/hooks/useAccount";
import { ELButton } from '@/shared/ui/ELButton';
import { ELModal } from '@/shared/ui/ELModal';
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShallow } from "zustand/react/shallow";
import { DocumentChooser } from "@/modules/quotes/ui/components/DocumentChooser";
// PostingUnitPicker: card de unidade de postagem ocultado a pedido do produto.
// O componente continua no projeto; reimportar aqui para reativar.
import { RecipientModal } from "@/modules/quotes/ui/components/RecipientModal";
import { LabelPreview } from "@/modules/quotes/ui/components/LabelPreview";
// O campo de seguro voltou para a tela de cotação, para o preço já sair
// completo na lista de opções. InsuranceField segue no projeto caso precise.
import { ResultsBanner } from "@/modules/quotes/ui/components/ResultsBanner";
import { useQuoteStore } from '@/modules/quotes/ui/state/useQuoteStore';
import { useCartAdd } from "@/modules/cart/ui/hooks";
import { useRecipientSave } from "@/modules/quotes/ui/hooks";
import {
  createFinalizeFormSchema,
  validateVolumeDocumentsOnSubmit,
  type FinalizeFormValues,
} from '@/shared/types/quoteFinalize';
import type { DocumentType } from '@/shared/types/quote';
import { useQuoteDraft } from "@/modules/quotes/ui/state/quoteDraft";
import { useCheckoutStore } from '@/modules/cart/ui/state/checkout';
import { CheckoutModal } from "@/modules/payments/ui/components/CheckoutModal";
import { PaidCheckoutModal, type CheckoutData } from "@/modules/payments/ui/components/PaidCheckoutModal";
import { usePickupFee } from "@/modules/quotes/ui/hooks";
import { generateUUID } from "@/shared/utils/uuid";
import { useAddressStore } from "@/modules/auth/ui/state/addresses";
import { useAddresses } from "@/modules/account/ui/hooks";

const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

export default function FinalizarClient() {
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
  const recipientPays = useQuoteDraft((s) => s.recipientPays);
  const setRecipientPays = useQuoteDraft((s) => s.setRecipientPays);
  const pickupPointId = useCheckoutStore((s) => s.pickupPointId);
  const cartAdd = useCartAdd();
  const recipientSave = useRecipientSave();

  // Buscar endereço de origem selecionado (dados completos do banco)
  const selectedOriginId = useAddressStore((s) => s.selectedOriginId);
  const addressesQuery = useAddresses();
  const selectedOriginAddress = useMemo(() => {
    if (!selectedOriginId || !addressesQuery.data) return null;
    return addressesQuery.data.find((a) => a.id === selectedOriginId) ?? null;
  }, [selectedOriginId, addressesQuery.data]);

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

  // Estado para código de rastreamento reservado (garantia de unicidade)
  const [reservedTrackingCode, setReservedTrackingCode] = useState<string | null>(null);
  const [isReservingCode, setIsReservingCode] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);

  // Estado para os dados do checkout (novo fluxo)
  const [paidCheckoutData, setPaidCheckoutData] = useState<CheckoutData | null>(null);
  const [paidCheckoutModalOpen, setPaidCheckoutModalOpen] = useState(false);

  // Estado adicional para evitar múltiplos cliques
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Estado para o modal de destinatário
  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  // Flag para controlar se o modal já foi aberto automaticamente nesta sessão
  const [hasAutoOpenedRecipientModal, setHasAutoOpenedRecipientModal] = useState(false);

  // Estado para o fluxo de pagamento pelo destinatário
  const [isCreatingRecipientPayment, setIsCreatingRecipientPayment] = useState(false);
  const [recipientPaymentSuccess, setRecipientPaymentSuccess] = useState<{
    paymentUrl: string;
    recipientEmail: string;
    expiresAt: string;
  } | null>(null);

  // Estado para modal de email (destinatário recorrente sem email)
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalValue, setEmailModalValue] = useState("");
  const [emailModalRecipientId, setEmailModalRecipientId] = useState<string | null>(null);
  const [isUpdatingRecipientEmail, setIsUpdatingRecipientEmail] = useState(false);
  // Flag para indicar que estamos esperando confirmação de email (para reverter toggle se cancelar)
  const [pendingRecipientPaysToggle, setPendingRecipientPaysToggle] = useState(false);

  // Função para reservar código de rastreamento com retry automático
  const reserveTrackingCode = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    setIsReservingCode(true);
    setReservationError(null);

    try {
      console.log('[TRACKING_CODE] Reservando código de rastreamento...');
      const response = await fetch('/api/tracking-codes/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const code = result.data?.code;

      if (code) {
        console.log('[TRACKING_CODE] Código reservado:', code);
        setReservedTrackingCode(code);
        setReservationError(null);
      } else {
        throw new Error('Código não retornado');
      }
    } catch (error) {
      console.error('[TRACKING_CODE] Erro ao reservar código (tentativa', retryCount + 1, '):', error);

      // Retry automático
      if (retryCount < MAX_RETRIES) {
        console.log('[TRACKING_CODE] Tentando novamente em 1s...');
        setTimeout(() => reserveTrackingCode(retryCount + 1), 1000);
        return;
      }

      // Após todas as tentativas, marcar erro (botão fica desabilitado)
      setReservationError('Erro ao preparar checkout');
      setIsReservingCode(false);
      return;
    }

    setIsReservingCode(false);
  };

  // Reservar código de rastreamento único ao montar (se houver cotação válida)
  useEffect(() => {
    // Só reservar se tiver cotação válida e ainda não tiver código reservado
    if (!results || !selection || reservedTrackingCode || isReservingCode || reservationError) {
      return;
    }

    reserveTrackingCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reserveTrackingCode é estável (só usa setState)
  }, [results, selection, reservedTrackingCode, isReservingCode, reservationError]);

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
          // Novo formato unificado: documento por volume (NFE ou Declaração independentemente)
          volumeDocuments: Array.from({ length: volumesCount }, (_, idx) => ({
            volumeIndex: idx,
            type: null, // Será definido quando o usuário preencher
            nfeKey: undefined,
            nfeXmlId: undefined,
            nfeItems: undefined,
            declarationItems: undefined,
          })),
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
              id: generateUUID(),
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
                id: generateUUID(),
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

  // Helper: verificar se dados manuais do destinatário estão completos
  // Campos obrigatórios: Nome, CPF/CNPJ e Número
  const isRecipientDataComplete = useMemo(() => {
    // Se há destinatário recorrente selecionado, dados estão completos
    if (destino?.mode === "recipient" && !!destino.recipientId) {
      return true;
    }
    // Se modo manual, verificar apenas campos obrigatórios (Nome, CPF, Número)
    return (
      !!recipientNome && recipientNome.trim().length > 0 &&
      !!recipientDocumento && recipientDocumento.trim().length > 0 &&
      !!recipientNumero && recipientNumero.trim().length > 0
    );
  }, [destino, recipientNome, recipientDocumento, recipientNumero]);

  // Abrir modal de destinatário automaticamente se modo manual e dados incompletos
  useEffect(() => {
    // Só abrir uma vez por sessão
    if (hasAutoOpenedRecipientModal) return;
    // Só abrir se modo manual
    if (destino?.mode !== "manual") return;
    // Só abrir se dados incompletos
    if (isRecipientDataComplete) return;
    // Aguardar hidratação e dados básicos
    if (!summary) return;

    // Abrir modal automaticamente
    setIsRecipientModalOpen(true);
    setHasAutoOpenedRecipientModal(true);
  }, [destino, isRecipientDataComplete, hasAutoOpenedRecipientModal, summary]);

  // Watch document fields to validate items
  // Using useWatch for better reactivity with nested fields
  const documentType = useWatch({ control, name: "document.type" });

  // A DC-e exige CPF/CNPJ do remetente. A checagem também existe no servidor,
  // mas precisa estar AQUI: no pagamento por cartão a cobrança acontece antes
  // da criação do envio, então barrar só lá deixa o cliente cobrado e sem
  // envio. Foi exatamente o que aconteceu no primeiro teste.
  const { data: perfil } = useProfile();
  const remetenteTemDocumento = Boolean(
    perfil?.cpf?.trim() || perfil?.company?.cnpj?.trim()
  );
  const faltaDocumentoDoRemetente =
    documentType === "DECLARACAO" && perfil !== undefined && !remetenteTemDocumento;
  const declarationItems = useWatch({ control, name: "document.declarationItems" });
  const volumeDeclarations = useWatch({ control, name: "document.volumeDeclarations" });
  const volumeDocuments = useWatch({ control, name: "document.volumeDocuments" });
  const nfePackages = useWatch({ control, name: "document.packages" });
  const nfeItems = useWatch({ control, name: "document.nfeItems" });

  // Helper: verificar se há pelo menos 1 item válido no documento
  const hasAtLeastOneDocumentItem = useMemo(() => {
    // Novo formato unificado: volumeDocuments (cada volume pode ter NFE ou DECLARACAO)
    if (volumeDocuments && Array.isArray(volumeDocuments) && volumeDocuments.length > 0) {
      // Verificar se TODOS os volumes têm documento definido
      const allVolumesHaveDoc = volumeDocuments.every((vol) => {
        if (!vol?.type) return false;
        if (vol.type === "NFE") {
          // Validar chave E itens (itens vêm do XML)
          return vol.nfeKey && vol.nfeKey.length === 44 &&
            vol.nfeItems && vol.nfeItems.length > 0;
        }
        if (vol.type === "DECLARACAO") {
          return vol.declarationItems && vol.declarationItems.length > 0 &&
            vol.declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0);
        }
        return false;
      });

      console.log('[DEBUG DOC ITEMS - volumeDocuments]', {
        documentType,
        allVolumesHaveDoc,
        volumeDocumentsDetails: volumeDocuments.map((vol, idx) => ({
          volumeIndex: idx,
          type: vol?.type,
          hasNfeKey: vol?.nfeKey && vol.nfeKey.length === 44,
          hasNfeItems: vol?.nfeItems && vol.nfeItems.length > 0,
          nfeItemsCount: vol?.nfeItems?.length ?? 0,
          hasDeclaration: vol?.declarationItems && vol.declarationItems.length > 0,
        })),
      });

      if (allVolumesHaveDoc) return true;
    }

    // Fallback para formatos legados
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
        declarationItemsCount: declarationItems?.length ?? 0,
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
  }, [documentType, declarationItems, volumeDeclarations, volumeDocuments, nfePackages, nfeItems]);

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
      pickupPoint: true,
      documentItems: hasAtLeastOneDocumentItem,
    };

    // Check if recipient is valid
    const hasRecurringRecipient = destino?.mode === "recipient" && !!destino.recipientId;

    // Check manual recipient validity (apenas campos obrigatórios: Nome, CPF, Número)
    // Campos de endereço são preenchidos automaticamente
    const isRecipientFormValid =
      recipientMode === "manual" &&
      !!recipientNome && recipientNome.trim().length > 0 &&
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
    if (!checks.documentItems) return false;
    if (!canProceed) return false;
    if (faltaDocumentoDoRemetente) return false;

    // P2: Bloquear se código não foi reservado ou houve erro
    if (!reservedTrackingCode || reservationError) return false;

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
    reservedTrackingCode,
    reservationError,
    faltaDocumentoDoRemetente,
    recipientLogradouro,
    recipientBairro,
    recipientCidade,
    recipientUf,
    hasAtLeastOneDocumentItem,
  ]);

  // Mensagem de tooltip para botões desabilitados
  const disabledTooltip = useMemo(() => {
    if (preconditionsOk) return "";

    // Aguardando preparação do checkout
    if (isReservingCode || !reservedTrackingCode) {
      return "Preparando...";
    }

    // Verificar dados do destinatário
    // Alinhado com a lógica de /cotacoes: destinatário é válido se:
    // - há um destinatário recorrente selecionado OU
    // - há CEP de destino válido (modo manual)
    const hasRecurringRecipient = destino?.mode === "recipient" && !!destino.recipientId;
    const hasManualDestination = !!summary?.destinoCep && summary.destinoCep.length > 0;

    // Para finalizar, campos obrigatórios: Nome, CPF, Número + endereço preenchido automaticamente
    const isRecipientFormValid =
      recipientMode === "manual" &&
      !!recipientNome && recipientNome.trim().length > 0 &&
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

    if (faltaDocumentoDoRemetente) {
      return "Informe seu CPF ou CNPJ em Minha conta para enviar com declaração de conteúdo.";
    }

    return "Preencha todos os campos obrigatórios para continuar.";
  }, [
    preconditionsOk,
    isReservingCode,
    reservedTrackingCode,
    faltaDocumentoDoRemetente,
    hasAtLeastOneDocumentItem,
    pickupAtOrigin,
    pickupPointId,
    destino,
    recipientMode,
    recipientNome,
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

    // Se dados do destinatário incompletos (modo manual), abrir modal
    if (destino?.mode === "manual" && !isRecipientDataComplete) {
      setIsRecipientModalOpen(true);
      return;
    }

    // Busca valores mínimos necessários para adicionar ao carrinho
    const values = formMethods.getValues();

    // Validar volumeDocuments se estiver usando o novo formato
    const volumeDocsValidation = validateVolumeDocumentsOnSubmit(values);
    if (!volumeDocsValidation.isValid) {
      console.log('[CART_ADD] ❌ Validação de volumeDocuments falhou:', volumeDocsValidation.errors);
      const firstError = volumeDocsValidation.errors[0];
      message.error(firstError?.message || 'Preencha os dados do documento fiscal para cada volume.');
      return;
    }

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
      // Usa dados completos do endereço selecionado (do banco)
      const payload = {
        originAddress: {
          cep: selectedOriginAddress?.cep || summary.origemCep,
          logradouro: selectedOriginAddress?.logradouro || '',
          numero: selectedOriginAddress?.numero || '',
          complemento: selectedOriginAddress?.complemento || '',
          bairro: selectedOriginAddress?.bairro || '',
          cidade: selectedOriginAddress?.cidade || summary.origemCidade || '',
          uf: selectedOriginAddress?.uf || summary.origemUf || '',
          nome: selectedOriginAddress?.label || '', // label = apelido do endereço
        },
        destination: {
          cep: summary.destinoCep,
          logradouro: recipientData?.logradouro || '',
          numero: recipientData?.numero || '',
          bairro: recipientData?.bairro || '',
          cidade: summary.destinoCidade || '',
          uf: summary.destinoUf || '',
          nome: recipientData?.nome || '',
          telefone: recipientData?.telefone || '',
          email: recipientData?.email || '',
          documento: recipientData?.documento || '',
          complemento: recipientData?.complemento || '',
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
          source: 'quote' as const,
        },
        totals: {
          total: totalAmount,
          subtotal: selectedService.preco,
          pickupFee: pickupFeeAmount,
          moeda: 'BRL',
        },
        // Documento fiscal (NFE/Declaração) - igual ao checkout direto
        document: {
          type: values.document.type,
          // Novo formato NFE: packages (converter de volumeDocuments se disponível)
          packages: values.document.type === "NFE"
            ? (() => {
                const volumeDocs = values.document.volumeDocuments as any[] | undefined;
                const fromVolumeDocuments = (volumeDocs || [])
                  .filter((vol) => vol?.type === "NFE" && vol?.nfeKey && vol.nfeKey.length === 44)
                  .map((vol) => ({
                    chave: vol.nfeKey as string,
                    xmlId: vol.nfeXmlId || null,
                    items: (vol.nfeItems || []).map((item: { id?: string; sku?: string | null; descricao?: string; ncm?: string | null; cfop?: string | null; unidade?: string | null; quantidade?: number; pesoLiquido?: number | null; valorUnitario?: number; valorTotal?: number; impostos?: unknown }) => ({
                      id: item.id || "",
                      sku: item.sku || null,
                      descricao: item.descricao || "",
                      ncm: item.ncm || null,
                      cfop: item.cfop || null,
                      unidade: item.unidade || null,
                      quantidade: item.quantidade || 1,
                      pesoLiquido: item.pesoLiquido || null,
                      valorUnitario: item.valorUnitario || 0,
                      valorTotal: item.valorTotal || 0,
                      impostos: item.impostos || null,
                    })),
                    // Dados completos da NF-e para espelho
                    nfeData: vol.nfeData || null,
                  }));

                // Se há dados em volumeDocuments, usar
                if (fromVolumeDocuments.length > 0) {
                  return fromVolumeDocuments;
                }

                // Fallback: usar packages diretamente
                return values.document.packages;
              })()
            : undefined,
          // Campos legados para retrocompatibilidade
          nfeKeys: values.document.type === "NFE" ? values.document.nfeKeys : undefined,
          nfeItems: values.document.type === "NFE" ? values.document.nfeItems : undefined,
          declarationItems: values.document.type === "DECLARACAO" ? values.document.declarationItems : undefined,
          // Converter volumeDocuments (formato do UI) para volumeDeclarations (formato da API)
          volumeDeclarations: values.document.type === "DECLARACAO"
            ? (() => {
                const volumeDocs = values.document.volumeDocuments as any[] | undefined;
                const fromVolumeDocuments = (volumeDocs || [])
                  .filter((vol) =>
                    vol.declarationItems && vol.declarationItems.length > 0 &&
                    vol.declarationItems.some((item: { descricao?: string }) =>
                      item.descricao && item.descricao.trim().length > 0
                    )
                  )
                  .map((vol) => ({
                    volumeIndex: vol.volumeIndex as number,
                    items: (vol.declarationItems || []).map((item: { id?: string; descricao?: string; valorUnitario?: number; quantidade?: number }) => ({
                      id: item.id || "",
                      descricao: item.descricao || "",
                      valorUnitario: item.valorUnitario || 0,
                      quantidade: item.quantidade || 1,
                    })),
                  }));

                if (fromVolumeDocuments.length > 0) {
                  return fromVolumeDocuments;
                }

                return values.document.volumeDeclarations;
              })()
            : undefined,
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

    // Se dados do destinatário incompletos (modo manual), abrir modal
    if (destino?.mode === "manual" && !isRecipientDataComplete) {
      setIsRecipientModalOpen(true);
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
      // Validar volumeDocuments se estiver usando o novo formato
      const volumeDocsValidation = validateVolumeDocumentsOnSubmit(values);
      if (!volumeDocsValidation.isValid) {
        console.log('[HANDLE_PAY_NOW] ❌ Validação de volumeDocuments falhou:', volumeDocsValidation.errors);
        const firstError = volumeDocsValidation.errors[0];
        message.error(firstError?.message || 'Preencha os dados do documento fiscal para cada volume.');
        setIsProcessingCheckout(false);
        return;
      }

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
        // SECURITY FIX F-01: Enviar quoteId (ID da Quote), não selectionId (ID da QuoteSelection)
        quoteId: selection.quoteId,
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
          // Novo formato NFE: packages (converter de volumeDocuments se disponível)
          packages: values.document.type === "NFE"
            ? (() => {
                const volumeDocs = values.document.volumeDocuments as any[] | undefined;
                const fromVolumeDocuments = (volumeDocs || [])
                  .filter((vol) => vol?.type === "NFE" && vol?.nfeKey && vol.nfeKey.length === 44)
                  .map((vol) => ({
                    chave: vol.nfeKey as string,
                    xmlId: vol.nfeXmlId || null,
                    items: (vol.nfeItems || []).map((item: { id?: string; sku?: string | null; descricao?: string; ncm?: string | null; cfop?: string | null; unidade?: string | null; quantidade?: number; pesoLiquido?: number | null; valorUnitario?: number; valorTotal?: number; impostos?: unknown }) => ({
                      id: item.id || "",
                      sku: item.sku || null,
                      descricao: item.descricao || "",
                      ncm: item.ncm || null,
                      cfop: item.cfop || null,
                      unidade: item.unidade || null,
                      quantidade: item.quantidade || 1,
                      pesoLiquido: item.pesoLiquido || null,
                      valorUnitario: item.valorUnitario || 0,
                      valorTotal: item.valorTotal || 0,
                      impostos: item.impostos || null,
                    })),
                    // Dados completos da NF-e para espelho
                    nfeData: vol.nfeData || null,
                  }));

                // Se há dados em volumeDocuments, usar
                if (fromVolumeDocuments.length > 0) {
                  return fromVolumeDocuments;
                }

                // Fallback: usar packages diretamente
                return values.document.packages;
              })()
            : undefined,
          // Campos legados para retrocompatibilidade
          nfeKeys: values.document.type === "NFE" ? values.document.nfeKeys : undefined,
          nfeItems: values.document.type === "NFE" ? values.document.nfeItems : undefined,
          declarationItems: values.document.type === "DECLARACAO" ? values.document.declarationItems : undefined,
          // Converter volumeDocuments (formato do UI) para volumeDeclarations (formato da API)
          // Prioriza volumeDocuments se tiver dados, senão usa volumeDeclarations
          volumeDeclarations: values.document.type === "DECLARACAO"
            ? (() => {
                // Tentar extrair de volumeDocuments primeiro (formato novo do UI)
                const volumeDocs = values.document.volumeDocuments as any[] | undefined;
                const fromVolumeDocuments = (volumeDocs || [])
                  .filter((vol) =>
                    vol.declarationItems && vol.declarationItems.length > 0 &&
                    vol.declarationItems.some((item: { descricao?: string }) =>
                      item.descricao && item.descricao.trim().length > 0
                    )
                  )
                  .map((vol) => ({
                    volumeIndex: vol.volumeIndex as number,
                    items: (vol.declarationItems || []).map((item: { id?: string; descricao?: string; valorUnitario?: number; quantidade?: number }) => ({
                      id: item.id || "",
                      descricao: item.descricao || "",
                      valorUnitario: item.valorUnitario || 0,
                      quantidade: item.quantidade || 1,
                    })),
                  }));

                // Se volumeDocuments tem dados válidos, usar
                if (fromVolumeDocuments.length > 0) {
                  return fromVolumeDocuments;
                }

                // Fallback: usar volumeDeclarations diretamente (formato legado)
                return values.document.volumeDeclarations;
              })()
            : undefined,
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
        // Dados completos do endereço de origem para integração com transportadora
        originAddress: {
          cep: selectedOriginAddress?.cep || summary.origemCep || "",
          logradouro: selectedOriginAddress?.logradouro || "",
          numero: selectedOriginAddress?.numero || "",
          complemento: selectedOriginAddress?.complemento || "",
          bairro: selectedOriginAddress?.bairro || "",
          cidade: selectedOriginAddress?.cidade || summary.origemCidade || "",
          uf: selectedOriginAddress?.uf || summary.origemUf || "",
          nome: selectedOriginAddress?.label || "",
        },
        destinationCep: summary.destinoCep || "",
        estimatedDays: selectedService.prazoDias,
        freightCost: selectedService.preco,
        totalCost: totalAmount,
        solicitarColeta: pickupAtOrigin, // Usar pickupAtOrigin do quoteDraft
        // Código de rastreamento reservado (garante unicidade)
        reservedTrackingCode: reservedTrackingCode || undefined,
      };

      console.log('[CHECKOUT_FRONTEND] Payload completo sendo enviado:', JSON.stringify(payload, null, 2));
      console.log('[CHECKOUT_FRONTEND] payload.recipient.salvarRecorrente:', payload.recipient.salvarRecorrente);

      // NOVO FLUXO: Se tiver código reservado, usar PaidCheckoutModal
      // O shipment será criado APÓS confirmação do pagamento
      if (reservedTrackingCode) {
        console.log('[CHECKOUT_FRONTEND] Usando NOVO FLUXO com código reservado:', reservedTrackingCode);

        // Preparar dados para o novo modal (sem criar shipment ainda)
        const checkoutData: CheckoutData = {
          // SECURITY FIX F-01: quoteId obrigatório para validar preços no servidor
          // IMPORTANTE: Usar selection.quoteId (ID da Quote), não selection.selectionId (ID da QuoteSelection)
          quoteId: selection.quoteId,
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
          document: payload.document,
          volumes: payload.volumes,
          insuranceValue: payload.insuranceValue,
          freightCost: payload.freightCost,
          totalCost: totalAmount,
          pickupPointId: payload.pickupPointId,
          solicitarColeta: payload.solicitarColeta,
          pickupFee: payload.pickupFee,
          carrier: payload.carrier,
          service: payload.service,
          originCep: payload.originCep,
          originCidade: payload.originCidade,
          originUf: payload.originUf,
          originAddress: payload.originAddress,
          destinationCep: payload.destinationCep,
          estimatedDays: payload.estimatedDays,
        };

        setPaidCheckoutData(checkoutData);
        setPaidCheckoutModalOpen(true);

        dispatchTelemetry("checkout_modal_opened", {
          selectionId: selection.selectionId,
          trackingCode: reservedTrackingCode,
          flow: "new_paid_checkout",
        });
      } else {
        // FLUXO LEGADO: Criar shipment primeiro, pagar depois
        console.log('[CHECKOUT_FRONTEND] Usando FLUXO LEGADO (sem código reservado)');

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
          flow: "legacy_checkout",
        });
      }
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

  /**
   * Handler para criar solicitacao de pagamento pelo destinatario
   * Em vez de criar shipment + pagar, cria RecipientPaymentRequest e envia link
   */
  const handleRecipientPayment: SubmitHandler<FinalizeFormValues> = async (values) => {
    if (isCreatingRecipientPayment) {
      console.log('[RECIPIENT_PAYMENT] ⚠️ Ja esta criando, ignorando clique duplicado');
      return;
    }

    // Se dados do destinatario incompletos (modo manual), abrir modal
    if (destino?.mode === "manual" && !isRecipientDataComplete) {
      setIsRecipientModalOpen(true);
      return;
    }

    // Verificar se a cotacao expirou
    const wasExpired = clearIfExpired();
    if (wasExpired) {
      message.warning("Sua cotacao expirou. Por favor, faca uma nova cotacao.");
      router.push("/cotacoes");
      return;
    }

    setIsCreatingRecipientPayment(true);
    console.log('[RECIPIENT_PAYMENT] 🔒 Iniciando criacao de solicitacao');

    try {
      // Validar volumeDocuments se estiver usando o novo formato
      const volumeDocsValidation = validateVolumeDocumentsOnSubmit(values);
      if (!volumeDocsValidation.isValid) {
        console.log('[RECIPIENT_PAYMENT] ❌ Validacao de volumeDocuments falhou:', volumeDocsValidation.errors);
        const firstError = volumeDocsValidation.errors[0];
        message.error(firstError?.message || 'Preencha os dados do documento fiscal para cada volume.');
        return;
      }

      if (!selection || !results || !summary || !selectedService) {
        message.error("Nenhuma selecao de servico ativa.");
        return;
      }

      // Determinar dados do destinatario
      let recipientData: FinalizeFormValues['recipient']['manual'] | undefined;

      if (values.recipient.mode === "manual") {
        recipientData = values.recipient.manual;

        if (!recipientData?.cidade || !recipientData?.uf || !recipientData?.cep) {
          message.error("Dados do destinatario incompletos. Informe ao menos CEP, cidade e UF.");
          return;
        }
      } else if (values.recipient.mode === "saved" && values.recipient.savedId) {
        try {
          const response = await fetch(`/api/account/recipients/${values.recipient.savedId}`);
          if (!response.ok) {
            message.error("Erro ao buscar dados do destinatario selecionado.");
            return;
          }
          const result = await response.json();
          const recipient = result.data;
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
            salvarRecorrente: false,
          };

          if (!recipientData.cidade || !recipientData.uf || !recipientData.cep) {
            message.error("Destinatario selecionado possui dados incompletos.");
            return;
          }
        } catch (error) {
          console.error('[RECIPIENT_PAYMENT] Erro ao buscar destinatario:', error);
          message.error("Erro ao buscar dados do destinatario.");
          return;
        }
      } else {
        message.error("Selecione ou preencha os dados do destinatario.");
        return;
      }

      // Validar que o destinatario tem email (obrigatorio para pagamento pelo destinatario)
      if (!recipientData?.email) {
        message.error("E-mail do destinatario e obrigatorio para pagamento pelo destinatario.");
        return;
      }

      // Calcular total incluindo taxa de coleta se aplicavel
      const pickupFeeAmount = pickupFeeData && pickupFeeData.success ? pickupFeeData.feeAmount : 0;
      const totalAmount = selectedService.preco + pickupFeeAmount;

      // Montar payload para criar RecipientPaymentRequest
      const payload = {
        // Origem
        origin: {
          addressId: selectedOriginId || undefined,
          cep: selectedOriginAddress?.cep || summary.origemCep || "",
          city: selectedOriginAddress?.cidade || summary.origemCidade || "",
          state: selectedOriginAddress?.uf || summary.origemUf || "",
          address: selectedOriginAddress?.logradouro || undefined,
          neighborhood: selectedOriginAddress?.bairro || undefined,
          number: selectedOriginAddress?.numero || undefined,
          complement: selectedOriginAddress?.complemento || undefined,
        },
        // Destino
        destination: {
          cep: recipientData.cep || summary.destinoCep || "",
          city: recipientData.cidade || summary.destinoCidade || "",
          state: recipientData.uf || summary.destinoUf || "",
          address: recipientData.logradouro || undefined,
          neighborhood: recipientData.bairro || undefined,
          number: recipientData.numero || undefined,
          complement: recipientData.complemento || undefined,
        },
        // Destinatario
        recipient: {
          name: recipientData.nome || "",
          email: recipientData.email,
          phone: recipientData.telefone || undefined,
          document: recipientData.documento || undefined,
        },
        // Volumes
        packages: summary.volumes.map((v, idx) => ({
          packageNumber: idx + 1,
          width: v.larguraCm,
          height: v.alturaCm,
          length: v.comprimentoCm,
          weight: v.pesoKg,
        })),
        // Cotacao
        quote: {
          carrier: selectedService.carrier,
          service: selectedService.modalidade,
          serviceCode: selectedService.modalidade,
          estimatedDays: selectedService.prazoDias,
          freightCostCents: Math.round(selectedService.preco * 100),
          pickupFeeCents: pickupFeeAmount > 0 ? Math.round(pickupFeeAmount * 100) : undefined,
          totalCents: Math.round(totalAmount * 100),
          shippingCommissionCents: undefined, // Calculado no backend
          pickupCommissionCents: undefined,
        },
        // Outros
        totalWeight: summary.volumes.reduce((acc, v) => acc + v.pesoKg, 0),
        declaredValue: summary.seguroValor || 0,
        pickupAtOrigin: pickupAtOrigin,
        document: {
          type: values.document.type,
          volumeDocuments: values.document.volumeDocuments,
        },
      };

      console.log('[RECIPIENT_PAYMENT] Enviando payload:', JSON.stringify(payload, null, 2));

      // Criar RecipientPaymentRequest via API
      const res = await fetch("/api/recipient-payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erro ao criar solicitacao de pagamento");
      }

      const result = await res.json();

      // Mostrar modal de sucesso
      setRecipientPaymentSuccess({
        paymentUrl: result.data.paymentUrl,
        recipientEmail: recipientData.email,
        expiresAt: new Date(result.data.request.expiresAt).toLocaleString('pt-BR'),
      });

      dispatchTelemetry("recipient_payment_created", {
        selectionId: selection.selectionId,
        requestId: result.data.request.id,
      });

      message.success("Link de pagamento enviado para o destinatario!");
    } catch (error: unknown) {
      console.error("[RECIPIENT_PAYMENT] Erro:", error);
      const errorMessage = error instanceof Error ? error.message : "Nao foi possivel criar a solicitacao.";
      message.error(errorMessage);
    } finally {
      setIsCreatingRecipientPayment(false);
      console.log('[RECIPIENT_PAYMENT] 🔓 Criacao finalizada');
    }
  };

  /**
   * Handler para mudança do toggle "Destinatário paga o frete"
   * Verifica se o destinatário tem email e solicita se necessário
   */
  const handleRecipientPaysToggle = async (checked: boolean) => {
    // Se está desativando, apenas desativar
    if (!checked) {
      setRecipientPays(false);
      setPendingRecipientPaysToggle(false);
      return;
    }

    // Se está ativando, verificar se tem email do destinatário
    console.log('[RECIPIENT_PAYS_TOGGLE] Verificando email do destinatário', {
      mode: destino?.mode,
      recipientId: destino?.recipientId,
      recipientEmail,
    });

    // Caso 1: Destinatário recorrente (salvo)
    if (destino?.mode === "recipient" && destino.recipientId) {
      try {
        // Buscar dados do destinatário para verificar email
        const response = await fetch(`/api/account/recipients/${destino.recipientId}`);
        if (!response.ok) {
          message.error("Erro ao verificar dados do destinatário.");
          return;
        }

        const result = await response.json();
        const recipient = result.data;

        console.log('[RECIPIENT_PAYS_TOGGLE] Destinatário recorrente:', {
          name: recipient.name,
          email: recipient.email,
        });

        if (recipient.email) {
          // Tem email, ativar normalmente
          setRecipientPays(true);
          // Atualizar o form com o email do destinatário
          formMethods.setValue("recipient.manual.email", recipient.email);
        } else {
          // Não tem email, abrir modal para solicitar
          setPendingRecipientPaysToggle(true);
          setEmailModalRecipientId(destino.recipientId);
          setEmailModalValue("");
          setEmailModalOpen(true);
        }
      } catch (error) {
        console.error('[RECIPIENT_PAYS_TOGGLE] Erro ao buscar destinatário:', error);
        message.error("Erro ao verificar dados do destinatário.");
      }
      return;
    }

    // Caso 2: Destinatário manual (não recorrente)
    if (destino?.mode === "manual") {
      // Verificar se já tem email preenchido
      const currentEmail = formMethods.getValues("recipient.manual.email");

      console.log('[RECIPIENT_PAYS_TOGGLE] Destinatário manual:', {
        currentEmail,
        isRecipientDataComplete,
      });

      if (currentEmail && currentEmail.trim().length > 0) {
        // Tem email, ativar normalmente
        setRecipientPays(true);
      } else {
        // Não tem email, abrir modal do destinatário para preencher
        setPendingRecipientPaysToggle(true);
        setIsRecipientModalOpen(true);
        message.info("Informe o e-mail do destinatário para continuar.");
      }
      return;
    }

    // Caso 3: Nenhum destinatário selecionado ainda
    message.warning("Selecione ou preencha os dados do destinatário primeiro.");
  };

  /**
   * Handler para confirmar email no modal (destinatário recorrente)
   */
  const handleEmailModalConfirm = async () => {
    if (!emailModalValue || !emailModalValue.includes("@")) {
      message.error("Informe um e-mail válido.");
      return;
    }

    if (!emailModalRecipientId) {
      message.error("ID do destinatário não encontrado.");
      return;
    }

    setIsUpdatingRecipientEmail(true);

    try {
      // Atualizar email do destinatário no banco
      const response = await fetch(`/api/account/recipients/${emailModalRecipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailModalValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao atualizar email");
      }

      // Sucesso - atualizar form e ativar toggle
      formMethods.setValue("recipient.manual.email", emailModalValue);
      setRecipientPays(true);
      setPendingRecipientPaysToggle(false);
      setEmailModalOpen(false);
      setEmailModalValue("");
      setEmailModalRecipientId(null);
      message.success("E-mail do destinatário atualizado!");
    } catch (error) {
      console.error('[EMAIL_MODAL] Erro ao atualizar email:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar email.";
      message.error(errorMessage);
    } finally {
      setIsUpdatingRecipientEmail(false);
    }
  };

  /**
   * Handler para cancelar modal de email
   */
  const handleEmailModalCancel = () => {
    setEmailModalOpen(false);
    setEmailModalValue("");
    setEmailModalRecipientId(null);

    // Se estava esperando confirmação, reverter toggle
    if (pendingRecipientPaysToggle) {
      setRecipientPays(false);
      setPendingRecipientPaysToggle(false);
    }
  };

  /**
   * Handler para quando o RecipientModal é fechado
   * Verificar se email foi preenchido para manter ou reverter o toggle
   */
  const handleRecipientModalClose = () => {
    setIsRecipientModalOpen(false);

    // Se estava esperando confirmação de email
    if (pendingRecipientPaysToggle) {
      const currentEmail = formMethods.getValues("recipient.manual.email");

      if (currentEmail && currentEmail.trim().length > 0 && currentEmail.includes("@")) {
        // Email preenchido, ativar toggle
        setRecipientPays(true);
      } else {
        // Email não preenchido, reverter toggle
        setRecipientPays(false);
      }
      setPendingRecipientPaysToggle(false);
    }
  };

  const handleBackToQuotes = () => {
    sessionStorage.setItem("preserveQuoteState", "1");
    router.push("/cotacoes");
  };

  const backButton = (
    <ELButton
      icon={<ArrowLeftOutlined />}
      onClick={handleBackToQuotes}
      size="small"
      style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}
    >
      Voltar
    </ELButton>
  );

  if (!results || !selection) {
    return (
      <PageShell title="Finalizar Envio" gap="md" extra={backButton}>
        <ELSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title="Finalizar Envio" gap="md" extra={backButton}>
      <FormProvider {...formMethods}>
        <form>
          {/* Resumo do envio, serviço e pagamento lado a lado no topo */}
          <ELGrid variant="finalizar" gap="md">
            <ResultsBanner summary={summary!} />
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
              showRecipientPaysToggle
              recipientPays={recipientPays}
              onRecipientPaysChange={handleRecipientPaysToggle}
              // Seguro (valor declarado) fica junto do preço que ele altera:
              // informá-lo dispara nova cotação e atualiza o frete acima.
            />
            <ELCard
              header={{ title: "Pagamento" }}
              padding="md"
            >
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                {/* Botoes condicionais */}
                {!recipientPays ? (
                  <>
                    <Tooltip title={disabledTooltip}>
                      <ELButton
                        htmlType="button"
                        block
                        size="small"
                        loading={cartAdd.isPending}
                        disabled={!selectedService || !preconditionsOk}
                        onClick={onAddToCartClick}
                      >
                        Adicionar ao carrinho
                      </ELButton>
                    </Tooltip>
                    <Tooltip title={disabledTooltip}>
                      <ELButton
                        variant="primary"
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
                              message.error('Por favor, preencha todos os campos obrigatorios.');
                              setIsProcessingCheckout(false);
                            }
                          )(e);
                        }}
                      >
                        Pagar agora
                      </ELButton>
                    </Tooltip>
                    {/* Mensagem de erro explícita para dispositivos touch (oculta em desktop) */}
                    {disabledTooltip && !preconditionsOk && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, textAlign: 'center', display: 'block' }}
                        className="mobile-only-message"
                      >
                        {disabledTooltip}
                      </Typography.Text>
                    )}
                  </>
                ) : (
                  <>
                    <Tooltip title={!recipientEmail ? "Informe o e-mail do destinatario" : disabledTooltip}>
                      <ELButton
                        variant="primary"
                        htmlType="button"
                        block
                        size="small"
                        loading={isCreatingRecipientPayment}
                        disabled={isCreatingRecipientPayment || !preconditionsOk || !recipientEmail}
                        onClick={(e) => {
                          console.log('[RECIPIENT_PAY_CLICK]', {
                            isCreatingRecipientPayment,
                            preconditionsOk,
                            recipientEmail,
                          });
                          handleSubmit(
                            handleRecipientPayment,
                            (validationErrors) => {
                              console.log('[FORM_VALIDATION_FAILED]', validationErrors);
                              message.error('Por favor, preencha todos os campos obrigatorios.');
                              setIsCreatingRecipientPayment(false);
                            }
                          )(e);
                        }}
                      >
                        Enviar link de pagamento
                      </ELButton>
                    </Tooltip>
                    {/* Mensagem de erro explícita para dispositivos touch (oculta em desktop) */}
                    {((!recipientEmail || !preconditionsOk) && (disabledTooltip || !recipientEmail)) && (
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, textAlign: 'center', display: 'block' }}
                        className="mobile-only-message"
                      >
                        {!recipientEmail ? "Informe o e-mail do destinatário" : disabledTooltip}
                      </Typography.Text>
                    )}
                  </>
                )}
              </Space>
            </ELCard>
          </ELGrid>

          {/* Indicador visual de destinatário pendente (modo manual) */}
          {destino?.mode === "manual" && !isRecipientDataComplete && (
            <ELAlert
              type="warning"
              showIcon
              title={
                <Space size={8} align="center">
                  <span style={{ fontSize: 13 }}>
                    <strong>Destinatário pendente</strong> - Complete os dados para finalizar.
                  </span>
                  <ELButton
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setIsRecipientModalOpen(true)}
                    style={{ fontSize: 12 }}
                  >
                    Preencher
                  </ELButton>
                </Space>
              }
              style={{ marginTop: 12, padding: "8px 12px" }}
            />
          )}

          {/* Indicador quando destinatário preenchido (modo manual) */}
          {destino?.mode === "manual" && isRecipientDataComplete && (
            <ELAlert
              type="success"
              showIcon
              title={
                <Space size={8} align="center">
                  <span style={{ fontSize: 13 }}>
                    <strong>Destinatário:</strong> {recipientNome} - {recipientCidade}/{recipientUf}
                  </span>
                  <ELButton
                    size="small"
                    variant="link"
                    icon={<EditOutlined />}
                    onClick={() => setIsRecipientModalOpen(true)}
                    style={{ fontSize: 12 }}
                  >
                    Editar
                  </ELButton>
                </Space>
              }
              style={{ marginTop: 12, padding: "8px 12px" }}
            />
          )}

          {/* Formulários */}
          <Space orientation="vertical" size={24} style={{ width: "100%", marginTop: 24 }}>
            {/* Unidade de postagem ocultada a pedido do produto. A escolha
                já não era obrigatória (preconditionsOk mantém pickupPoint
                sempre true), então esconder o card não bloqueia o avanço.
                O componente segue no projeto para reativação futura. */}
            <ELGrid variant="forms" gap="xl">
              <DocumentChooser />
            </ELGrid>
          </Space>

        </form>

        {/* Modal de dados do destinatário */}
        <RecipientModal
          open={isRecipientModalOpen}
          onClose={handleRecipientModalClose}
        />

        {/* Modal simples para captura de email (destinatário recorrente sem email) */}
        <ELModal
          title="E-mail do destinatário"
          open={emailModalOpen}
          onCancel={handleEmailModalCancel}
          footer={[
            <ELButton
              key="cancel"
              onClick={handleEmailModalCancel}
            >
              Cancelar
            </ELButton>,
            <ELButton
              key="confirm"
              variant="primary"
              loading={isUpdatingRecipientEmail}
              onClick={handleEmailModalConfirm}
            >
              Confirmar
            </ELButton>,
          ]}
        >
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Typography.Text>
              Para enviar o link de pagamento, informe o e-mail do destinatário.
              Este e-mail será salvo no cadastro do destinatário.
            </Typography.Text>
            <div>
              <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                E-mail
              </Typography.Text>
              <input
                type="email"
                placeholder="email@exemplo.com"
                value={emailModalValue}
                onChange={(e) => setEmailModalValue(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  fontSize: 14,
                }}
                autoFocus
              />
            </div>
          </Space>
        </ELModal>

        {/* Modal de escolha de pagamento (FLUXO LEGADO) */}
        {createdShipment && (
          <CheckoutModal
            open={checkoutModalOpen}
            onClose={() => setCheckoutModalOpen(false)}
            shipmentId={createdShipment.id}
            totalAmount={createdShipment.totalAmount}
            trackingCode={createdShipment.trackingCode}
          />
        )}

        {/* Modal de pagamento integrado (NOVO FLUXO - shipment criado após pagamento) */}
        {paidCheckoutData && reservedTrackingCode && (
          <PaidCheckoutModal
            open={paidCheckoutModalOpen}
            onClose={() => {
              setPaidCheckoutModalOpen(false);
              setIsProcessingCheckout(false);
            }}
            checkoutData={paidCheckoutData}
            trackingCode={reservedTrackingCode}
            totalAmount={paidCheckoutData.totalCost}
          />
        )}

        {/* Modal de sucesso - Pagamento pelo destinatario */}
        <ELModal
          title="Link de pagamento enviado!"
          open={!!recipientPaymentSuccess}
          onCancel={() => {
            setRecipientPaymentSuccess(null);
            router.push("/shipments");
          }}
          footer={[
            <ELButton
              key="new"
              onClick={() => {
                setRecipientPaymentSuccess(null);
                // Limpar estado da cotacao
                useQuoteDraft.getState().clear();
                router.push("/cotacoes");
              }}
            >
              Nova cotacao
            </ELButton>,
            <ELButton
              key="list"
              variant="primary"
              onClick={() => {
                setRecipientPaymentSuccess(null);
                router.push("/pagamentos-pendentes");
              }}
            >
              Ver solicitacoes
            </ELButton>,
          ]}
        >
          {recipientPaymentSuccess && (
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <ELAlert
                type="success"
                showIcon
                title="E-mail enviado com sucesso"
                description={`Um link de pagamento foi enviado para ${recipientPaymentSuccess.recipientEmail}`}
              />

              <div style={{ background: "#f5f5f5", padding: 16, borderRadius: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Detalhes da solicitacao
                </Typography.Text>

                <div style={{ marginTop: 8 }}>
                  <Typography.Text strong>Valido ate:</Typography.Text>{" "}
                  <Typography.Text>{recipientPaymentSuccess.expiresAt}</Typography.Text>
                </div>

                <div style={{ marginTop: 4 }}>
                  <Typography.Text strong>Link:</Typography.Text>{" "}
                  <Typography.Text
                    copyable
                    style={{ fontSize: 12, wordBreak: "break-all" }}
                  >
                    {recipientPaymentSuccess.paymentUrl}
                  </Typography.Text>
                </div>
              </div>

              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                O destinatario tem 72 horas para efetuar o pagamento.
                Voce pode acompanhar o status na area de solicitacoes pendentes.
              </Typography.Text>
            </Space>
          )}
        </ELModal>
      </FormProvider>
    </PageShell>
  );
}
