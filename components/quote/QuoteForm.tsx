"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  App,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Radio,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
  type UseFormReturn,
  type SubmitHandler,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShallow } from "zustand/react/shallow";
import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import { maskCEP } from "@/lib/masks";
import { useQuoteStore } from "@/store/useQuoteStore";
import type {
  QuoteCalculateResponse,
  QuoteRequestPayload,
  QuoteResultItem,
  QuoteSummary,
  QuoteVolume,
} from "@/types/quote";
import { useQuoteCalculate } from "@/hooks/useQuotes";
import { fetchCepV2, normalizeCep, formatCep } from "@/lib/services/brasilapi";
import { AddressSelect } from "@/components/addresses/AddressSelect";
import { RecipientSelect } from "@/components/recipients/RecipientSelect";
import type { Recipient } from "@/types/account";
import { useAddresses, useAccountRecipients } from "@/hooks/useAccount";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { RouteCards } from "@/components/shipping/RouteCards";
import { OriginCard } from "@/components/shipping/OriginCard";
import { DestinationCard } from "@/components/shipping/DestinationCard";
import {
  swapRouteValues as swapRouteFormValues,
  type RouteValues as SwapRouteValues,
} from "@/lib/utils/swapRouteValues";
import {
  getCompanyDefaultAddress,
  type CompanyAddress,
  useAddressStore,
  type Address as StoreAddress,
} from "@/lib/state/addresses";
import { generateUUID } from "@/lib/utils/uuid";

// Extracted components
import { quoteFormSchema, MAX_VOLUMES, type QuoteFormValues } from "./quoteFormSchema";
import {
  addressesEqual,
  companyAddressKeys,
  computeTotals,
  createEmptyVolume,
  dispatchTelemetry,
  mapStoreAddressToCompany as mapStoreAddressToCompanyFn,
  toHeaderInfo,
} from "./quoteFormHelpers";
import { DestinationModeSelector } from "./DestinationModeSelector";
import { InsuranceInput } from "./InsuranceInput";
import { PickupToggle } from "./PickupToggle";
import { ReverseToggle } from "./ReverseToggle";
import { VolumesGrid, DEFAULT_CUBAGE_FACTOR } from "./VolumesGrid";
import { VolumesTotalizer } from "./VolumesTotalizer";
import { QuoteResultsSection } from "./QuoteResultsSection";

// Re-export QuoteFormValues from schema for external use
export type { QuoteFormValues } from "./quoteFormSchema";

type QuoteFormProps = {
  defaultOrigin?: {
    cep: string;
    cidade?: string;
    uf?: string;
    label?: string;
    isDefault?: boolean;
  } | null;
};

export function QuoteForm({ defaultOrigin }: QuoteFormProps) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const calculateQuotes = useQuoteCalculate();

  const { form: storedForm, setResults } = useQuoteStore(
    useShallow((state) => ({
      form: state.form,
      setResults: state.setResults,
    })),
  );

  const quoteDraft = useQuoteDraft();

  // Buscar endereços via React Query (mesma fonte que AddressSelect)
  const addressesQuery = useAddresses();
  const addresses = useMemo(() => addressesQuery.data ?? [], [addressesQuery.data]);

  // Manter zustand apenas para selectedOriginId (controle de seleção)
  const {
    selectedOriginId,
    selectOrigin,
  } = useAddressStore();

  const companyAddress = getCompanyDefaultAddress();

  const defaultCompanyAddress = useMemo<CompanyAddress | null>(() => {
    if (!addresses?.length && !companyAddress && !defaultOrigin) {
      return null;
    }
    if (companyAddress) {
      return companyAddress;
    }
    if (defaultOrigin) {
      return {
        cep: defaultOrigin.cep,
        cidade: defaultOrigin.cidade,
        uf: defaultOrigin.uf,
        nome: defaultOrigin.label,
      };
    }
    return null;
  }, [addresses, companyAddress, defaultOrigin]);

  const storedOriginAddress = useMemo<CompanyAddress | undefined>(() => {
    if (!storedForm) return undefined;
    if (
      !storedForm.origemCep &&
      !storedForm.origemCidade &&
      !storedForm.origemUf &&
      !storedForm.origemLabel
    ) {
      return undefined;
    }
    return {
      cep: storedForm.origemCep ?? undefined,
      cidade: storedForm.origemCidade ?? undefined,
      uf: storedForm.origemUf ?? undefined,
      nome: storedForm.origemLabel ?? undefined,
    };
  }, [storedForm]);

  const storedDestinationAddress = useMemo<CompanyAddress | undefined>(() => {
    if (!storedForm) return undefined;
    if (
      !storedForm.destinoCep &&
      !storedForm.destinoCidade &&
      !storedForm.destinoUf
    ) {
      return undefined;
    }
    return {
      cep: storedForm.destinoCep ?? undefined,
      cidade: storedForm.destinoCidade ?? undefined,
      uf: storedForm.destinoUf ?? undefined,
    };
  }, [storedForm]);

  // Use imported helper function (stable reference at module level)
  const mapStoreAddressToCompany = mapStoreAddressToCompanyFn;

  const defaultVolumes = storedForm?.volumes?.length
    ? storedForm.volumes.map((item) => ({ ...item }))
    : [createEmptyVolume()];

  const formMethods = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: "onBlur", // Validar apenas no blur, não no onChange
    reValidateMode: "onBlur",
    defaultValues: {
      origem: (storedOriginAddress ?? defaultCompanyAddress ?? {}) as CompanyAddress,
      destino: (storedDestinationAddress ?? {}) as CompanyAddress,
      modoOrigem: "manual",
      modoDestino: "manual",
      remetenteRecorrenteId: null,
      destinatarioRecorrenteId: null,
      origemCep: storedForm?.origemCep
        ? maskCEP(storedForm.origemCep)
        : defaultCompanyAddress?.cep
        ? maskCEP(defaultCompanyAddress.cep)
        : "",
      destinoCep: storedForm?.destinoCep
        ? maskCEP(storedForm.destinoCep)
        : storedDestinationAddress?.cep
        ? maskCEP(storedDestinationAddress.cep)
        : "",
      coleta: storedForm?.coleta ?? false,
      devolucao: storedForm?.devolucao ?? false,
      seguroValor: storedForm?.seguroValor ?? undefined,
      volumes: defaultVolumes,
    },
  });

  const { control, handleSubmit, watch, setValue, getValues, trigger } =
    formMethods;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "volumes",
  });

  // Estado e store de endereços - declarado antes dos useEffects que o usam
  useEffect(() => {
    if (!fields.length) {
      replace([createEmptyVolume()]);
    }
  }, [fields.length, replace]);

  // Inicializa seleção de endereço com default (se houver)
  useEffect(() => {
    if (!selectedOriginId && addresses.length) {
      // Encontrar endereço padrão ou primeiro disponível
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (defaultAddr?.id) selectOrigin(defaultAddr.id);
    }
  }, [addresses, selectedOriginId, selectOrigin]);

  // Carregar destino salvo ao montar
  useEffect(() => {
    if (!destination) return;

    // Restaurar modo
    setDestinationMode(destination.mode);

    // Restaurar CEP no form
    if (destination.cep) {
      setValue("destinoCep", destination.cep, { shouldValidate: true });
    }

    // Restaurar informações visuais
    if (destination.city && destination.state) {
      setDestinoInfo({
        cidade: destination.city,
        uf: destination.state,
      });
      setCepStatus((status) => ({ ...status, destino: true }));
    }

    // Se for modo recipient, restaurar seleção
    if (destination.mode === "recipient" && destination.recipientId) {
      setSelectedRecipientId(destination.recipientId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas na montagem

  const [origemInfo, setOrigemInfo] = useState<{
    cidade?: string;
    uf?: string;
    label?: string;
    cep?: string;
    isDefault?: boolean;
  } | null>(null); // Inicializa vazio - useEffect reativo preencherá

  const [destinoInfo, setDestinoInfo] = useState<{
    cidade?: string;
    uf?: string;
    label?: string;
    cep?: string;
    isDefault?: boolean;
  } | null>(null); // Inicializa vazio - useEffect reativo preencherá

  const [cepStatus, setCepStatus] = useState({
    origem: Boolean(storedForm?.origemCep ?? defaultCompanyAddress?.cep),
    destino: Boolean(storedForm?.destinoCep),
  });

  // Refs para evitar loops de consulta CEP (apenas destino)
  const lastResolvedOrigin = useRef<string>("");
  const lastResolvedDest = useRef<string>("");
  const focusOriginResolved = useRef<boolean>(false);
  const focusDestResolved = useRef<boolean>(false);

  // Estados de loading e erro para CEP de destino
  const [clientCepLoading, setClientCepLoading] = useState(false);
  const [clientCepError, setClientCepError] = useState<string | null>(null);


  // Estados para destinatário
  const { destination, setDestination, setPickupAtOrigin } = useQuoteDraft();
  const [destinationMode, setDestinationMode] = useState<"manual" | "recipient">(
    destination?.mode ?? "recipient"
  );
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    destination?.recipientId ?? null
  );

  // Sincronizar estados locais quando destination do store for limpo
  useEffect(() => {
    if (!destination) {
      setDestinationMode("recipient");
      setSelectedRecipientId(null);
    }
  }, [destination]);

  // Ref para rastrear o updatedAt do storedForm anterior
  // Isso permite detectar quando o store foi resetado (mudou de dados -> vazio)
  const previousUpdatedAt = useRef<string | null>(storedForm?.updatedAt || null);

  // Resetar TODO o formulário (incluindo volumes) quando storedForm for RESETADO
  // Detecta quando o store muda de "tem dados" para "vazio"
  useEffect(() => {
    const currentUpdatedAt = storedForm?.updatedAt || null;
    const isStoreEmpty = !storedForm || (!storedForm.destinoCep && !storedForm.coleta && storedForm.volumes.length === 0);

    // Detectar se o store foi resetado (updatedAt mudou OU store ficou vazio)
    const storeWasReset = previousUpdatedAt.current !== currentUpdatedAt && isStoreEmpty;

    if (storeWasReset) {
      // Resetar o formulário completamente para os valores padrão
      formMethods.reset({
        origem: (storedOriginAddress ?? defaultCompanyAddress ?? {}) as CompanyAddress,
        destino: {} as CompanyAddress,
        modoOrigem: "manual",
        modoDestino: "manual",
        remetenteRecorrenteId: null,
        destinatarioRecorrenteId: null,
        origemCep: defaultCompanyAddress?.cep ? maskCEP(defaultCompanyAddress.cep) : "",
        destinoCep: "",
        coleta: false,
        devolucao: false,
        seguroValor: undefined,
        volumes: [createEmptyVolume()],
      });
    }

    // Atualizar a ref com o valor atual
    previousUpdatedAt.current = currentUpdatedAt;
  }, [storedForm, formMethods, storedOriginAddress, defaultCompanyAddress, getValues]);

  // Buscar recipients via React Query (mesma fonte que RecipientSelect)
  const recipientsQuery = useAccountRecipients({ page: 1, pageSize: 1000 });
  const recipients = useMemo(() => recipientsQuery.data?.items ?? [], [recipientsQuery.data?.items]);

  // Estado para logística reversa
  const [isReverse, setIsReverse] = useState(false);

  // Estado para resultados da cotação
  const [quoteResults, setQuoteResults] = useState<QuoteResultItem[] | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);


  // Atualização reativa do header de origem/destino
  useEffect(() => {
    if (!isReverse) {
      // Modo normal: origem = endereço selecionado, destino = recipient/manual
      const originAddr = addresses?.find((x) => x.id === selectedOriginId);
      const headerInfo = toHeaderInfo(originAddr);

      // Apenas atualizar se os valores mudaram (previne loop infinito)
      setOrigemInfo(prev => {
        if (!prev && !headerInfo) return prev;
        if (!prev || !headerInfo) return headerInfo;
        if (prev.cidade === headerInfo.cidade &&
            prev.uf === headerInfo.uf &&
            prev.label === headerInfo.label &&
            prev.cep === headerInfo.cep &&
            prev.isDefault === headerInfo.isDefault) {
          return prev; // Sem mudança, retorna anterior para evitar re-render
        }
        return headerInfo;
      });

      // Atualizar destino se for modo recipient
      if (destinationMode === "recipient" && selectedRecipientId) {
        const recipientData = recipients?.find((r) => r.id === selectedRecipientId);
        if (recipientData) {
          setDestinoInfo(prev => {
            const newInfo = {
              cidade: recipientData.cidade,
              uf: recipientData.uf,
              label: recipientData.name,
              cep: recipientData.cep,
              isDefault: false,
            };
            if (!prev) return newInfo;
            if (prev.cidade === newInfo.cidade &&
                prev.uf === newInfo.uf &&
                prev.label === newInfo.label &&
                prev.cep === newInfo.cep &&
                prev.isDefault === newInfo.isDefault) {
              return prev;
            }
            return newInfo;
          });
        }
      }
    } else {
      // Modo reverso: origem = recipient/manual, destino = endereço selecionado
      const destinationAddr = addresses?.find((x) => x.id === selectedOriginId);
      const headerInfo = toHeaderInfo(destinationAddr);

      setDestinoInfo(prev => {
        if (!prev && !headerInfo) return prev;
        if (!prev || !headerInfo) return headerInfo;
        if (prev.cidade === headerInfo.cidade &&
            prev.uf === headerInfo.uf &&
            prev.label === headerInfo.label &&
            prev.cep === headerInfo.cep &&
            prev.isDefault === headerInfo.isDefault) {
          return prev;
        }
        return headerInfo;
      });

      // Atualizar origem se for modo recipient
      if (destinationMode === "recipient" && selectedRecipientId) {
        const recipientData = recipients?.find((r) => r.id === selectedRecipientId);
        if (recipientData) {
          setOrigemInfo(prev => {
            const newInfo = {
              cidade: recipientData.cidade,
              uf: recipientData.uf,
              label: recipientData.name,
              cep: recipientData.cep,
              isDefault: false,
            };
            if (!prev) return newInfo;
            if (prev.cidade === newInfo.cidade &&
                prev.uf === newInfo.uf &&
                prev.label === newInfo.label &&
                prev.cep === newInfo.cep &&
                prev.isDefault === newInfo.isDefault) {
              return prev;
            }
            return newInfo;
          });
        }
      }
    }
  }, [selectedOriginId, selectedRecipientId, addresses, recipients, isReverse, destinationMode]);

  const volumesValues = useWatch({ control, name: "volumes" });
  const totals = useMemo(
    () => computeTotals(volumesValues),
    [volumesValues],
  );

  const canSubmit =
    !calculateQuotes.isPending &&
    Boolean(selectedOriginId) && // Verificar se remetente foi selecionado
    (destinationMode === "manual" || Boolean(selectedRecipientId)) && // Verificar se destinatário foi selecionado (quando não manual)
    Boolean(cepStatus.origem) &&
    Boolean(cepStatus.destino);

  const handleAddVolume = useCallback(() => {
    if (fields.length >= MAX_VOLUMES) {
      message.info(`Limite máximo de ${MAX_VOLUMES} volumes por cotação atingido.`);
      return;
    }
    append(createEmptyVolume());
    message.success("Volume adicionado.");
  }, [append, fields.length, message]);

  const handleRemoveVolume = useCallback(
    (index: number) => {
      if (fields.length <= 1) {
        message.warning("É necessário manter ao menos um volume.");
        return;
      }
      remove(index);
      message.success("Volume removido.");
    },
    [fields.length, message, remove],
  );

  const handleImportVolumes = useCallback(
    (importedVolumes: { comprimentoCm: number; larguraCm: number; alturaCm: number; pesoKg: number }[]) => {
      const newVolumes = importedVolumes.map((v) => ({
        id: generateUUID(),
        comprimentoCm: v.comprimentoCm,
        larguraCm: v.larguraCm,
        alturaCm: v.alturaCm,
        pesoKg: v.pesoKg,
      }));
      replace(newVolumes);
    },
    [replace],
  );

  const applyReverseUI = useCallback((next: boolean) => {
    setIsReverse(next);
  }, []);

  const swapRouteState = useCallback(() => {
    const originSnapshot = origemInfo
      ? {
          cidade: origemInfo.cidade,
          uf: origemInfo.uf,
          label: origemInfo.label,
          isDefault: origemInfo.isDefault,
        }
      : null;
    const destinationSnapshot = destinoInfo
      ? {
          cidade: destinoInfo.cidade,
          uf: destinoInfo.uf,
          label: destinoInfo.label,
          isDefault: destinoInfo.isDefault,
        }
      : null;

    const currentOriginCep = getValues("origemCep") ?? "";
    const currentDestinationCep = getValues("destinoCep") ?? "";
    const normalizedOriginCep = normalizeCep(currentOriginCep);
    const normalizedDestinationCep = normalizeCep(currentDestinationCep);

    swapRouteFormValues(
      formMethods as unknown as UseFormReturn<SwapRouteValues>,
    );

    setValue("origemCep", formatCep(normalizedDestinationCep), {
      shouldDirty: true,
      shouldValidate: Boolean(normalizedDestinationCep),
    });
    setValue("destinoCep", formatCep(normalizedOriginCep), {
      shouldDirty: true,
      shouldValidate: Boolean(normalizedOriginCep),
    });

    setOrigemInfo(
      destinationSnapshot
        ? {
            cidade: destinationSnapshot.cidade,
            uf: destinationSnapshot.uf,
            label: destinationSnapshot.label,
            isDefault: destinationSnapshot.isDefault,
          }
        : null,
    );
    setDestinoInfo(
      originSnapshot
        ? {
            cidade: originSnapshot.cidade,
            uf: originSnapshot.uf,
            label: originSnapshot.label,
            isDefault: originSnapshot.isDefault,
          }
        : null,
    );

    setCepStatus(({ origem, destino }) => ({
      origem: destino,
      destino: origem,
    }));

    lastResolvedOrigin.current = normalizedDestinationCep;
    lastResolvedDest.current = normalizedOriginCep;
    focusOriginResolved.current = Boolean(normalizedDestinationCep);
    focusDestResolved.current = Boolean(normalizedOriginCep);
  }, [destinoInfo, formMethods, getValues, origemInfo, setValue]);

  const applyCompanySide = useCallback(
    (nextIsReverse: boolean) => {
      const selected = addresses.find((item) => item.id === selectedOriginId);
      const resolved =
        mapStoreAddressToCompany(selected) ??
        mapStoreAddressToCompany(
          addresses.find((item) => item.isDefault) ?? addresses[0] ?? null,
        ) ??
        defaultCompanyAddress;

      if (!resolved) return;

      const updateSide = (side: "origem" | "destino") => {
        const cepField = side === "origem" ? "origemCep" : "destinoCep";
        const modeField = side === "origem" ? "modoOrigem" : "modoDestino";
        const currentAddress = getValues(side) as CompanyAddress | undefined;
        const currentCep = getValues(cepField) ?? "";
        const currentMode = getValues(modeField) as
          | "manual"
          | "recorrente"
          | undefined;

        const normalized = resolved.cep ? normalizeCep(resolved.cep) : "";
        const masked = normalized ? formatCep(normalized) : "";

        if (currentCep !== masked) {
          setValue(cepField, masked, {
            shouldDirty: true,
            shouldValidate: Boolean(masked),
          });
        }

        if (!addressesEqual(currentAddress, resolved)) {
          setValue(side, resolved as CompanyAddress, { shouldDirty: true });
        }

        if (currentMode !== "manual") {
          setValue(modeField, "manual", { shouldDirty: true });
        }

        const nextInfo = {
          cidade: resolved.cidade,
          uf: resolved.uf,
          label: resolved.nome ?? "Endereço da empresa",
          isDefault: true,
        } as const;

        if (side === "origem") {
          setOrigemInfo((prev) =>
            prev &&
            prev.cidade === nextInfo.cidade &&
            prev.uf === nextInfo.uf &&
            prev.label === nextInfo.label &&
            prev.isDefault === nextInfo.isDefault
              ? prev
              : { ...nextInfo },
          );
        } else {
          setDestinoInfo((prev) =>
            prev &&
            prev.cidade === nextInfo.cidade &&
            prev.uf === nextInfo.uf &&
            prev.label === nextInfo.label &&
            prev.isDefault === nextInfo.isDefault
              ? prev
              : { ...nextInfo },
          );
        }

        setCepStatus((status) => {
          const next = Boolean(masked);
          if (status[side] === next) return status;
          return { ...status, [side]: next };
        });

        const lastRef = side === "origem" ? lastResolvedOrigin : lastResolvedDest;
        const focusRef = side === "origem"
          ? focusOriginResolved
          : focusDestResolved;

        lastRef.current = normalized;
        focusRef.current = Boolean(normalized);
      };

      if (nextIsReverse) {
        updateSide("destino");
      } else {
        updateSide("origem");
      }
    },
    [
      addresses,
      defaultCompanyAddress,
      getValues,
      mapStoreAddressToCompany,
      selectedOriginId,
      setDestinoInfo,
      setOrigemInfo,
      setValue,
      setCepStatus,
    ],
  );

  const handleReverseToggle = useCallback(
    (next: boolean) => {
      if (next === isReverse) return;

      swapRouteState();
      applyCompanySide(next);
      applyReverseUI(next);
      void trigger(["origem", "destino"]);
      void trigger(["origemCep", "destinoCep"]);
      void queryClient.invalidateQueries({ queryKey: ["rota"] });
    },
    [
      applyCompanySide,
      applyReverseUI,
      isReverse,
      queryClient,
      swapRouteState,
      trigger,
    ],
  );

  useEffect(() => {
    applyCompanySide(isReverse);
  }, [applyCompanySide, isReverse]);

  // Reset state e revalidar formulário ao montar/retornar para Step 1
  useEffect(() => {
    // Revalidar formulário para atualizar formState.isValid
    trigger().catch(() => {});
  }, [trigger]);

  const handleAddressChange = useCallback((id: string | null) => {
    // Atualiza store - o useEffect reativo cuidará de atualizar origemInfo/destinoInfo
    selectOrigin(id);

    // Atualizar campos do form e status de CEP
    if (id) {
      const selected = addresses.find((addr) => addr.id === id);
      if (selected) {
        const companyAddr = mapStoreAddressToCompany(selected);
        if (companyAddr) {
          if (!isReverse) {
            setValue("origem", companyAddr, { shouldDirty: false });
            setValue("origemCep", formatCep(companyAddr.cep ?? ""), { shouldValidate: false });
            setCepStatus((status) => ({ ...status, origem: true }));
          } else {
            setValue("destino", companyAddr, { shouldDirty: false });
            setValue("destinoCep", formatCep(companyAddr.cep ?? ""), { shouldValidate: false });
            setCepStatus((status) => ({ ...status, destino: true }));
          }
        }
      }
    }
  }, [selectOrigin, addresses, isReverse, mapStoreAddressToCompany, setValue]);

  const handleRecipientSelect = (recipientId: string | null, recipient?: Recipient | undefined) => {
    setSelectedRecipientId(recipientId);

    if (!recipientId || !recipient) {
      if (isReverse) {
        setValue("origem", {} as CompanyAddress, { shouldDirty: true });
        setValue("origemCep", "", { shouldValidate: false });
        setOrigemInfo(null);
        setCepStatus((status) => ({ ...status, origem: false }));
      } else {
        setValue("destino", {} as CompanyAddress, { shouldDirty: true });
        setValue("destinoCep", "", { shouldValidate: false });
        setDestinoInfo(null);
        setCepStatus((status) => ({ ...status, destino: false }));
      }
      return;
    }

    setValue(
      (isReverse ? "modoOrigem" : "modoDestino") as
        | "modoOrigem"
        | "modoDestino",
      "recorrente",
      { shouldDirty: true },
    );

    // Salvar na store de draft
    setDestination({
      mode: "recipient",
      recipientId: recipient.id,
      recipientName: recipient.name,
      cep: recipient.cep,
      city: recipient.cidade,
      state: recipient.uf,
      street: recipient.logradouro ?? null,
      neighborhood: recipient.bairro ?? null,
    });

    // Preencher o CEP no formulário
    const formattedCep = formatCep(normalizeCep(recipient.cep));
    const recipientAddress: CompanyAddress = {
      cep: formattedCep,
      cidade: recipient.cidade,
      uf: recipient.uf,
      nome: recipient.name,
      logradouro: recipient.logradouro ?? undefined,
      bairro: recipient.bairro ?? undefined,
      numero: recipient.numero ?? undefined,
      complemento: recipient.complemento ?? undefined,
    };

    if (isReverse) {
      setValue("origem", recipientAddress, { shouldDirty: true });
      setValue("origemCep", formattedCep, { shouldValidate: true });
      setOrigemInfo({
        cidade: recipient.cidade,
        uf: recipient.uf,
        label: recipient.name,
        isDefault: false,
      });
      setCepStatus((status) => ({ ...status, origem: true }));
    } else {
      setValue("destino", recipientAddress, { shouldDirty: true });
      setValue("destinoCep", formattedCep, { shouldValidate: true });
      setDestinoInfo({
        cidade: recipient.cidade,
        uf: recipient.uf,
        label: recipient.name,
        isDefault: false,
      });
      setCepStatus((status) => ({ ...status, destino: true }));
    }
  };


  const normalizeVolumes = (
    volumes: QuoteFormValues["volumes"],
  ): QuoteVolume[] =>
    volumes.map((volume) => ({
      id: volume.id,
      comprimentoCm: Number(volume.comprimentoCm),
      larguraCm: Number(volume.larguraCm),
      alturaCm: Number(volume.alturaCm),
      pesoKg: Number(volume.pesoKg),
    }));

  const buildSummary = (
    values: QuoteFormValues,
  ): QuoteSummary => ({
    origemCep: values.origemCep,
    origemCidade: origemInfo?.cidade,
    origemUf: origemInfo?.uf,
    origemLabel: origemInfo?.label,
    origemIsDefault: origemInfo?.isDefault,
    destinoCep: values.destinoCep,
    destinoCidade: destinoInfo?.cidade,
    destinoUf: destinoInfo?.uf,
    coleta: values.coleta,
    devolucao: values.devolucao,
    volumes: normalizeVolumes(values.volumes),
    seguroValor:
      values.seguroValor === undefined || values.seguroValor === null
        ? null
        : Number(values.seguroValor),
  });

  // Handlers de CEP da parte do cliente (onFocus/onBlur)
  const handleClientFocus = () => {
    if (isReverse) {
      focusOriginResolved.current = false;
    } else {
      focusDestResolved.current = false;
    }
  };

  const handleClientBlur = async () => {
    const focusResolvedRef = isReverse
      ? focusOriginResolved
      : focusDestResolved;
    if (focusResolvedRef.current) return;

    const fieldName = (isReverse ? "origemCep" : "destinoCep") as
      | "origemCep"
      | "destinoCep";
    const rawCep = getValues(fieldName);
    const normalized = normalizeCep(rawCep);

    if (normalized.length !== 8) {
      if (isReverse) {
        setOrigemInfo((info) =>
          info
            ? { ...info, cidade: undefined, uf: undefined, isDefault: false }
            : null,
        );
        setCepStatus((status) => ({ ...status, origem: false }));
      } else {
        setDestinoInfo(null);
        setCepStatus((status) => ({ ...status, destino: false }));
      }
      setClientCepError(null);
      return;
    }

    const lastResolvedRef = isReverse ? lastResolvedOrigin : lastResolvedDest;
    if (lastResolvedRef.current === normalized) {
      focusResolvedRef.current = true;
      return;
    }

    setClientCepLoading(true);
    setClientCepError(null);

    try {
      const data = await fetchCepV2(normalized);
      const formattedCep = formatCep(normalized);
      const clientAddress: CompanyAddress = {
        cep: formattedCep,
        cidade: data.city,
        uf: data.state,
        logradouro: data.street ?? undefined,
        bairro: data.neighborhood ?? undefined,
      };

      if (isReverse) {
        setValue("origem", clientAddress, { shouldDirty: true });
        setValue("origemCep", formattedCep, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setOrigemInfo({
          cidade: data.city,
          uf: data.state,
          label: origemInfo?.label,
          isDefault: false,
        });
        setCepStatus((status) => ({ ...status, origem: true }));
      } else {
        setValue("destino", clientAddress, { shouldDirty: true });
        setValue("destinoCep", formattedCep, {
          shouldDirty: true,
          shouldValidate: true,
        });
        setDestinoInfo({
          cidade: data.city,
          uf: data.state,
        });
        setCepStatus((status) => ({ ...status, destino: true }));
      }

      lastResolvedRef.current = normalized;
      focusResolvedRef.current = true;

      if (destinationMode === "manual") {
        setDestination({
          mode: "manual",
          cep: formattedCep,
          city: data.city,
          state: data.state,
          street: data.street ?? null,
          neighborhood: data.neighborhood ?? null,
        });
      }
    } catch (error) {
      const err = error as { message?: string };
      setClientCepError(err?.message || "Erro ao consultar CEP");
      if (isReverse) {
        setOrigemInfo((info) =>
          info
            ? { ...info, cidade: undefined, uf: undefined, isDefault: false }
            : null,
        );
        setCepStatus((status) => ({ ...status, origem: false }));
      } else {
        setDestinoInfo(null);
        setCepStatus((status) => ({ ...status, destino: false }));
      }
    } finally {
      setClientCepLoading(false);
    }
  };

  const onSubmit: SubmitHandler<QuoteFormValues> = async (values) => {
    const payload: QuoteRequestPayload = {
      origem: { cep: values.origemCep },
      destino: { cep: values.destinoCep },
      coleta: values.coleta,
      devolucao: values.devolucao,
      seguro:
        values.seguroValor === undefined || values.seguroValor === null
          ? null
          : Number(values.seguroValor),
      volumes: values.volumes.map((item) => ({
        comprimentoCm: Number(item.comprimentoCm) || 0,
        larguraCm: Number(item.larguraCm) || 0,
        alturaCm: Number(item.alturaCm) || 0,
        pesoKg: Number(item.pesoKg) || 0,
      })),
    };

    // Validar se há pelo menos um volume válido
    const hasValidVolume = payload.volumes.some(
      (v) => v.comprimentoCm > 0 && v.larguraCm > 0 && v.alturaCm > 0 && v.pesoKg > 0
    );

    if (!hasValidVolume) {
      message.error("Preencha ao menos um volume completo com dimensões e peso.");
      return;
    }

    try {
      const response = await calculateQuotes.mutateAsync(payload);

      const normalized: QuoteCalculateResponse = Array.isArray(response)
        ? { results: response }
        : response;

      if (!normalized.results.length) {
        setQuoteResults([]);
        setQuoteError(null);
        message.warning(
          "Nenhum serviço disponível para os parâmetros informados.",
        );
        return;
      }

      // Usar quoteId da API se disponível, senão gerar no cliente
      const quoteId = normalized.quoteId || generateUUID();

      const resumo = buildSummary(values);

      setResults({
        quoteId,
        createdAt: normalized.createdAt || new Date().toISOString(),
        expiresAt: normalized.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        resumo,
        results: normalized.results,
        pontosParceiros: normalized.pontosParceiros,
      });

      // Atualizar estado local para exibir resultados
      setQuoteResults(normalized.results);
      setQuoteError(null);

      dispatchTelemetry("quote_form_submit", {
        quoteId,
        volumesCount: values.volumes.length,
        pesoTotalKg: totals.pesoRealKg,
        pesoCubadoTotalKg: totals.pesoCubadoKg,
        coleta: values.coleta,
        devolucao: values.devolucao,
        hasInsuranceValue: Boolean(payload.seguro),
      });

      message.success(`${normalized.results.length} ${normalized.results.length === 1 ? "cotação encontrada" : "cotações encontradas"}`);
    } catch (error) {
      // Mostrar mensagem de erro específica se disponível
      const errorMessage = error instanceof Error ? error.message : String(error);

      setQuoteResults(null);
      setQuoteError(errorMessage);

      if (errorMessage.includes("Validação falhou:")) {
        // Erro de validação - mostrar detalhes
        message.error({
          content: errorMessage.replace("Validação falhou:", "Verifique os dados:"),
          duration: 8,
        });
      } else {
        // Erro genérico
        message.error("Não foi possível calcular as cotações. Tente novamente.");
      }
    }
  };

  const origemPlaceholder = isReverse
    ? "Selecione o endereço que receberá a devolução"
    : "Selecione um endereço de origem";
  const destinatarioPlaceholder = isReverse
    ? "Selecione quem enviará a devolução"
    : "Selecione um destinatário";
  const destinoModeLabel = isReverse
    ? "Como deseja informar o remetente?"
    : "Como deseja informar o destino?";
  const destinationManualLabel = isReverse
    ? "CEP do remetente"
    : "CEP de destino";
  const destinationManualHelper = isReverse
    ? "Informe o CEP de quem enviará a devolução."
    : "Informe o CEP de quem receberá o envio.";
  const companyCardTitle = isReverse ? "2) Destino" : "1) Origem";
  const clientCardTitle = isReverse ? "1) Origem" : "2) Destino";
  const destinationManualRadioLabel = isReverse
    ? "Informar manualmente o remetente"
    : "Informar manualmente o CEP";
  const destinationRecipientRadioLabel = isReverse
    ? "Selecionar remetente recorrente"
    : "Selecionar destinatário recorrente";
  const clientCardInfo = {
    cidade: isReverse
      ? origemInfo?.cidade ?? undefined
      : destinoInfo?.cidade ?? destination?.city ?? undefined,
    uf: isReverse
      ? origemInfo?.uf ?? undefined
      : destinoInfo?.uf ?? destination?.state ?? undefined,
    label: isReverse ? origemInfo?.label ?? undefined : destination?.recipientName ?? null,
  };

  const destinationModeSelector = (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
        {destinoModeLabel}
      </Typography.Text>
      <Radio.Group
        value={destinationMode}
        onChange={(e) => {
          const rawMode = e.target.value as "manual" | "recipient";
          const formMode: "manual" | "recorrente" =
            rawMode === "recipient" ? "recorrente" : "manual";
          setDestinationMode(rawMode);
          setValue(
            (isReverse ? "modoOrigem" : "modoDestino") as
              | "modoOrigem"
              | "modoDestino",
            formMode,
            { shouldDirty: true },
          );

          if (rawMode === "manual") {
            setSelectedRecipientId(null);
          } else {
            if (isReverse) {
              setValue("origemCep", "", { shouldValidate: false });
              setOrigemInfo((info) =>
                info
                  ? { ...info, cidade: undefined, uf: undefined, isDefault: false }
                  : null,
              );
              setCepStatus((status) => ({ ...status, origem: false }));
            } else {
              setValue("destinoCep", "", { shouldValidate: false });
              setDestinoInfo(null);
              setCepStatus((status) => ({ ...status, destino: false }));
            }
          }
        }}
        size="small"
      >
        <Radio value="manual">{destinationManualRadioLabel}</Radio>
        <Radio value="recipient">
          {destinationRecipientRadioLabel}
        </Radio>
      </Radio.Group>
    </div>
  );

  const companyCardContent = (
    <OriginCard
      title={companyCardTitle}
      info={isReverse ? destinoInfo : origemInfo}
      variant={isReverse ? "destination" : "origin"}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Form.Item
          label="Endereço selecionado"
          required
          colon={false}
          style={{ marginBottom: 0 }}
        >
          <AddressSelect
            value={selectedOriginId}
            onChange={handleAddressChange}
            placeholder={origemPlaceholder}
          />
        </Form.Item>

        {!isReverse && (
          <Controller
            control={control}
            name="coleta"
            render={({ field }) => (
              <Space orientation="vertical" style={{ width: "100%" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: calculateQuotes.isPending ? "not-allowed" : "pointer" }}>
                  <Switch
                    checked={field.value}
                    onChange={(checked) => {
                      field.onChange(checked);
                      setPickupAtOrigin(checked);
                    }}
                    disabled={calculateQuotes.isPending}
                  />
                  <div>
                    <Typography.Text>
                      Solicitar coleta na origem
                    </Typography.Text>
                    <br />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Disponível para CEPs com cobertura de coleta
                    </Typography.Text>
                  </div>
                </label>
              </Space>
            )}
          />
        )}
      </Space>
    </OriginCard>
  );

  const clientCardContent = (
    <DestinationCard
      title={clientCardTitle}
      info={clientCardInfo}
      modeSelector={destinationModeSelector}
      variant={isReverse ? "origin" : "destination"}
      tag=
        {destinationMode === "recipient" ? (
          <Tag color="success" bordered={false}>
            {isReverse ? "Remetente recorrente" : "Destinatário recorrente"}
          </Tag>
        ) : null}
    >
      {destinationMode === "manual" ? (
        <Controller
          name={(isReverse ? "origemCep" : "destinoCep") as
            | "origemCep"
            | "destinoCep"}
          control={control}
          render={({ field, fieldState }) => {
            const clientStatus = isReverse
              ? cepStatus.origem
              : cepStatus.destino;
            // Sempre manter suffix presente para evitar perda de foco (warning Ant Design)
            const suffix = (
              <span style={{ visibility: clientCepLoading || clientStatus || clientCepError ? 'visible' : 'hidden', width: 14, display: 'inline-block' }}>
                {clientCepLoading ? (
                  <Spin size="small" />
                ) : clientStatus ? (
                  <CheckCircleTwoTone twoToneColor="#389e0d" />
                ) : clientCepError ? (
                  <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                ) : (
                  <span />
                )}
              </span>
            );

            return (
              <Form.Item
                label={destinationManualLabel}
                validateStatus={
                  (fieldState.isTouched && fieldState.error) || clientCepError ? "error" : undefined
                }
                help={
                  (fieldState.isTouched && fieldState.error?.message) ||
                  clientCepError ||
                  destinationManualHelper
                }
              >
                <Input
                  {...field}
                  value={formatCep(field.value ?? "")}
                  onChange={(e) => {
                    const normalized = normalizeCep(e.target.value);
                    field.onChange(formatCep(normalized));
                  }}
                  onFocus={handleClientFocus}
                  onBlur={() => {
                    field.onBlur();
                    void handleClientBlur();
                  }}
                  maxLength={9}
                  placeholder="00000-000"
                  suffix={suffix}
                  autoComplete="postal-code"
                  inputMode="numeric"
                />
              </Form.Item>
            );
          }}
        />
      ) : (
        <Form.Item
          label={
            isReverse
              ? "Remetente recorrente"
              : "Destinatário recorrente"
          }
        >
          <RecipientSelect
            value={selectedRecipientId}
            onChange={handleRecipientSelect}
            placeholder={destinatarioPlaceholder}
          />
        </Form.Item>
      )}
    </DestinationCard>
  );

  const originCardNode = isReverse ? clientCardContent : companyCardContent;
  const destinationCardNode = isReverse
    ? companyCardContent
    : clientCardContent;

  return (
    <FormProvider {...formMethods}>
      <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
        <Space orientation="vertical" size={24} style={{ width: "100%" }}>
          <Card>
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              <Flex justify="center">
                <ReverseToggle
                  isReverse={isReverse}
                  onChange={handleReverseToggle}
                  disabled={calculateQuotes.isPending}
                />
              </Flex>

              <RouteCards
                isReverse={isReverse}
                originCard={originCardNode}
                destinationCard={destinationCardNode}
              />
            </Space>
          </Card>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={10}>
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <InsuranceInput control={control} />

                <VolumesTotalizer
                  volumeCount={fields.length}
                  totalPesoCubadoKg={totals.pesoCubadoKg}
                />

                <Card>
                  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                    <div>
                      <Typography.Title level={5} style={{ marginBottom: 4 }}>
                        Volumes do envio
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        Informe medidas internas e peso de cada volume
                      </Typography.Text>
                    </div>

                    <VolumesGrid
                      control={control}
                      fields={fields}
                      values={volumesValues}
                      onAdd={handleAddVolume}
                      onRemove={handleRemoveVolume}
                      onImport={handleImportVolumes}
                      maxCount={MAX_VOLUMES}
                      totals={totals}
                      disableRemove={calculateQuotes.isPending}
                    />
                  </Space>
                </Card>
              </Space>
            </Col>

            <Col xs={24} lg={14}>
              <QuoteResultsSection
                results={quoteResults}
                loading={calculateQuotes.isPending}
                error={quoteError}
                onCalculate={handleSubmit(onSubmit, (errors) => {
                  console.error('[FORM VALIDATION ERROR]', errors);
                  message.error('Preencha todos os campos obrigatórios corretamente.');
                })}
                canCalculate={canSubmit}
              />
            </Col>
          </Row>
        </Space>
      </Form>
    </FormProvider>
  );
}

// Testes manuais:
// - Reversa OFF: preencher CEP do cliente no destino, ativar reversa e verificar Origem=cliente, Destino=empresa.
// - Reversa ON: editar CEP do cliente, desativar reversa e confirmar que Destino permanece cliente e Origem volta a empresa.
// - Alternar ON/OFF várias vezes mantém os dados nas posições corretas sem perda.
// - Cabeçalho, passos, tag e barra-resumo refletem corretamente o fluxo “Empresa → Cliente” e “Cliente → Empresa”.
