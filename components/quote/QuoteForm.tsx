"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Space,
  Spin,
  Steps,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  Controller,
  FormProvider,
  SubmitHandler,
  UseFormReturn,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShallow } from "zustand/react/shallow";
import { CheckCircleTwoTone, CloseCircleTwoTone } from "@ant-design/icons";
import { maskCEP } from "@/lib/masks";
import {
  DEFAULT_CUBAGE_FACTOR,
  VolumesGrid,
} from "@/components/quote/VolumesGrid";
import { useQuoteStore } from "@/store/useQuoteStore";
import type {
  QuoteCalculateResponse,
  QuoteRequestPayload,
  QuoteSummary,
  QuoteVolume,
} from "@/types/quote";
import { useQuoteCalculate } from "@/hooks/useQuotes";
import { fetchCepV2, normalizeCep, formatCep } from "@/lib/services/brasilapi";
import { AddressSelect } from "@/components/addresses/AddressSelect";
import { AddressModal, type AddressFormValues } from "@/components/account/AddressModal";
import { RecipientSelect } from "@/components/recipients/RecipientSelect";
import { RecipientModal, type RecipientFormValues } from "@/components/recipients/RecipientModal";
import { useRecipientsStore } from "@/lib/state/recipients";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { RouteModeTag } from "@/components/shipping/RouteModeTag";
import {
  RouteSummaryBar,
  type RouteSummary,
} from "@/components/shipping/RouteSummaryBar";
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

const companyAddressKeys: Array<keyof CompanyAddress> = [
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "nome",
  "email",
  "telefone",
];

const addressesEqual = (
  a?: CompanyAddress | null,
  b?: CompanyAddress | null,
) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return companyAddressKeys.every((key) => (a[key] ?? "") === (b[key] ?? ""));
};

const MAX_VOLUMES = 30;
const cepRegex = /^\d{5}-\d{3}$/;

const volumeSchema = z.object({
  id: z.string().min(1),
  comprimentoCm: z
    .number()
    .gt(0, "Comprimento deve ser maior que zero."),
  larguraCm: z
    .number()
    .gt(0, "Largura deve ser maior que zero."),
  alturaCm: z
    .number()
    .gt(0, "Altura deve ser maior que zero."),
  pesoKg: z
    .number()
    .gt(0, "Peso deve ser maior que zero."),
});

const routeAddressSchema = z.object({
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  nome: z.string().optional(),
  email: z.string().optional(),
  telefone: z.string().optional(),
});

const quoteFormSchema = z.object({
  origem: routeAddressSchema.default({}),
  destino: routeAddressSchema.default({}),
  modoOrigem: z.enum(["manual", "recorrente"]).optional(),
  modoDestino: z.enum(["manual", "recorrente"]).optional(),
  remetenteRecorrenteId: z.string().nullable().optional(),
  destinatarioRecorrenteId: z.string().nullable().optional(),
  origemCep: z
    .string()
    .trim()
    .regex(cepRegex, "CEP inválido."),
  destinoCep: z
    .string()
    .trim()
    .regex(cepRegex, "CEP inválido."),
  coleta: z.boolean(),
  devolucao: z.boolean(),
  seguroValor: z
    .union([
      z
        .number()
        .min(0, "Valor do seguro deve ser maior ou igual a zero."),
      z.literal(null),
      z.undefined(),
    ])
    .optional(),
  lembrete: z
    .string()
    .trim()
    .max(40, "Lembrete deve ter no máximo 40 caracteres.")
    .optional(),
  volumes: z
    .array(volumeSchema)
    .min(1, "Adicione ao menos um volume.")
    .max(MAX_VOLUMES, `Limite máximo de ${MAX_VOLUMES} volumes.`),
});

export type QuoteFormValues = z.input<typeof quoteFormSchema>;

const createEmptyVolume = (): QuoteFormValues["volumes"][number] => ({
  id: crypto.randomUUID(),
  comprimentoCm: 0,
  larguraCm: 0,
  alturaCm: 0,
  pesoKg: 0,
});

const computeTotals = (volumes: QuoteFormValues["volumes"] | undefined) => {
  if (!volumes?.length) {
    return { pesoRealKg: 0, pesoCubadoKg: 0 };
  }
  return volumes.reduce(
    (acc, volume) => {
      const comprimento = Number(volume.comprimentoCm) || 0;
      const largura = Number(volume.larguraCm) || 0;
      const altura = Number(volume.alturaCm) || 0;
      const peso = Number(volume.pesoKg) || 0;
      const cubado =
        comprimento && largura && altura
          ? (comprimento * largura * altura) / DEFAULT_CUBAGE_FACTOR
          : 0;
      return {
        pesoRealKg: acc.pesoRealKg + peso,
        pesoCubadoKg: acc.pesoCubadoKg + cubado,
      };
    },
    { pesoRealKg: 0, pesoCubadoKg: 0 },
  );
};

const formatKg = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dispatchTelemetry = (event: string, detail?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
};

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const calculateQuotes = useQuoteCalculate();

  const { form: storedForm, setResults } = useQuoteStore(
    useShallow((state) => ({
      form: state.form,
      setResults: state.setResults,
    })),
  );

  const {
    selectedOriginId,
    selectOrigin,
    items: addresses,
    add: addAddress,
    getDefaultId,
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

  const mapStoreAddressToCompany = useCallback(
    (address: StoreAddress | null | undefined): CompanyAddress | null => {
      if (!address) return null;
      return {
        cep: address.cep,
        logradouro: address.logradouro,
        numero: address.numero,
        complemento: address.complemento,
        bairro: address.bairro,
        cidade: address.cidade,
        uf: address.uf,
        nome: address.apelido,
      };
    },
    [],
  );

  const defaultVolumes = storedForm?.volumes?.length
    ? storedForm.volumes.map((item) => ({ ...item }))
    : [createEmptyVolume()];

  const formMethods = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
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
      lembrete: storedForm?.lembrete ?? undefined,
      volumes: defaultVolumes,
    },
  });

  const { control, handleSubmit, watch, setValue, getValues, trigger, formState } =
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
      const id = getDefaultId();
      if (id) selectOrigin(id);
    }
  }, [addresses, selectedOriginId, selectOrigin, getDefaultId]);

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
    isDefault?: boolean;
  } | null>(
    storedForm?.origemCidade || storedForm?.origemUf
      ? {
          cidade: storedForm.origemCidade,
          uf: storedForm.origemUf,
          label: storedForm.origemLabel,
          isDefault: storedForm.origemIsDefault,
        }
      : defaultCompanyAddress
      ? {
          cidade: defaultCompanyAddress.cidade,
          uf: defaultCompanyAddress.uf,
          label: defaultCompanyAddress.nome ?? "Endereço da empresa",
          isDefault: true,
        }
      : null,
  );

  const [destinoInfo, setDestinoInfo] = useState<{
    cidade?: string;
    uf?: string;
    label?: string;
    isDefault?: boolean;
  } | null>(
    storedForm?.destinoCidade || storedForm?.destinoUf
      ? {
          cidade: storedForm.destinoCidade,
          uf: storedForm.destinoUf,
        }
      : null,
  );

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

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<string>(
    storedForm?.lembrete ?? "",
  );

  // Estado para modal de adicionar endereço
  const [addressModalOpen, setAddressModalOpen] = useState(false);

  // Estados para destinatário
  const { destination, setDestination, setPickupAtOrigin } = useQuoteDraft();
  const [destinationMode, setDestinationMode] = useState<"manual" | "recipient">(
    destination?.mode ?? "manual"
  );
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    destination?.recipientId ?? null
  );
  const recipients = useRecipientsStore((s) => s.items);
  const addRecipient = useRecipientsStore((s) => s.add);

  // Estado para logística reversa
  const [isReverse, setIsReverse] = useState(false);
  const [reverseAlertVisible, setReverseAlertVisible] = useState(false);
  const [reverseAlertMessage, setReverseAlertMessage] = useState<string | null>(
    null,
  );
  const reverseAlertTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (reverseAlertTimer.current) {
        window.clearTimeout(reverseAlertTimer.current);
        reverseAlertTimer.current = null;
      }
      setReverseAlertMessage(null);
    };
  }, []);

  const volumesValues = watch("volumes");
  const totals = useMemo(
    () => computeTotals(volumesValues),
    [volumesValues],
  );

  const lembreteValue = watch("lembrete");
  const origemCepValue = watch("origemCep");
  const destinoCepValue = watch("destinoCep");
  const origemAddressValue = watch("origem");
  const destinoAddressValue = watch("destino");
  const origemAddress = origemAddressValue as CompanyAddress | undefined;
  const destinoAddress = destinoAddressValue as CompanyAddress | undefined;

  const formatSummary = useCallback(
    ({
      name,
      city,
      state,
      cep,
      fallback,
    }: {
      name?: string | null;
      city?: string | null;
      state?: string | null;
      cep?: string | null;
      fallback: string;
    }): RouteSummary => {
      const trimmedName = name?.trim() || "";
      const trimmedCity = city?.trim() || "";
      const trimmedState = state?.trim() || "";
      const trimmedCep = cep?.trim() || "";

      const location =
        trimmedCity && trimmedState
          ? `${trimmedCity} / ${trimmedState}`
          : "";

      let primary = "";
      if (trimmedName && location) {
        primary = `${trimmedName} (${location})`;
      } else if (trimmedName) {
        primary = trimmedName;
      } else if (location) {
        primary = location;
      } else if (trimmedCep) {
        primary = `CEP ${trimmedCep}`;
      } else {
        primary = fallback;
      }

      const secondary = trimmedCep ? `CEP ${trimmedCep}` : undefined;

      return {
        primary,
        secondary,
      };
    },
    [],
  );

  const summaryOrigin = useMemo(
    () =>
      formatSummary({
        name: origemAddress?.nome ?? (isReverse ? "Cliente" : "Empresa"),
        city:
          origemAddress?.cidade ??
          (isReverse ? destinoInfo?.cidade ?? null : origemInfo?.cidade ?? null),
        state:
          origemAddress?.uf ??
          (isReverse ? destinoInfo?.uf ?? null : origemInfo?.uf ?? null),
        cep: origemCepValue,
        fallback: isReverse
          ? "Origem (cliente não definida)"
          : "Origem (empresa não definida)",
      }),
    [
      destinoInfo,
      formatSummary,
      isReverse,
      origemAddress,
      origemCepValue,
      origemInfo,
    ],
  );

  const summaryDestination = useMemo(
    () =>
      formatSummary({
        name: destinoAddress?.nome ?? (isReverse ? "Empresa" : "Cliente"),
        city:
          destinoAddress?.cidade ??
          (isReverse ? origemInfo?.cidade ?? null : destinoInfo?.cidade ?? null),
        state:
          destinoAddress?.uf ??
          (isReverse ? origemInfo?.uf ?? null : destinoInfo?.uf ?? null),
        cep: destinoCepValue,
        fallback: isReverse
          ? "Destino (empresa não definido)"
          : "Destino (cliente não definido)",
      }),
    [
      destinoAddress,
      destinoCepValue,
      destinoInfo,
      formatSummary,
      isReverse,
      origemInfo,
    ],
  );

  const canSubmit =
    formState.isValid &&
    cepStatus.origem &&
    cepStatus.destino &&
    !calculateQuotes.isPending;

  const handleAddVolume = useCallback(() => {
    if (fields.length >= MAX_VOLUMES) {
      message.info("Limite máximo de volumes atingido.");
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

  const applyReverseUI = useCallback(
    (next: boolean) => {
      if (reverseAlertTimer.current) {
        window.clearTimeout(reverseAlertTimer.current);
        reverseAlertTimer.current = null;
      }

      setIsReverse(next);
      setReverseAlertVisible(true);
      setReverseAlertMessage(
        next
          ? "Modo Logística Reversa ativado. O destinatário envia e a empresa recebe."
          : "Modo Envio ativado. A empresa envia e o destinatário recebe.",
      );

      reverseAlertTimer.current = window.setTimeout(() => {
        setReverseAlertVisible(false);
        setReverseAlertMessage(null);
        reverseAlertTimer.current = null;
      }, 5_000);
    },
    [],
  );

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

  const handleAddressModalOpen = () => {
    setAddressModalOpen(true);
  };

  const handleAddressModalSubmit = (values: AddressFormValues) => {
    const newAddress = {
      id: crypto.randomUUID(),
      apelido: values.label,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
      isDefault: values.isDefault,
    };

    addAddress(newAddress, { select: true });
    setAddressModalOpen(false);
    message.success("Endereço adicionado com sucesso!");
  };

  const handleRecipientModalSubmit = (values: RecipientFormValues) => {
    const newRecipient = {
      id: crypto.randomUUID(),
      name: values.name,
      doc: values.doc,
      phone: values.phone,
      email: values.email,
      cep: values.cep,
      logradouro: values.logradouro,
      numero: values.numero,
      complemento: values.complemento,
      bairro: values.bairro,
      cidade: values.cidade,
      uf: values.uf,
      notes: values.notes,
    };

    addRecipient(newRecipient);
    setSelectedRecipientId(newRecipient.id);
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
      recipientId: newRecipient.id,
      recipientName: newRecipient.name,
      cep: newRecipient.cep,
      city: newRecipient.cidade,
      state: newRecipient.uf,
      street: newRecipient.logradouro ?? null,
      neighborhood: newRecipient.bairro ?? null,
    });

    // Preencher o CEP no formulário
    const formattedCep = formatCep(normalizeCep(newRecipient.cep));
    const recipientAddress: CompanyAddress = {
      cep: formattedCep,
      cidade: newRecipient.cidade,
      uf: newRecipient.uf,
      nome: newRecipient.name,
      logradouro: newRecipient.logradouro ?? undefined,
      bairro: newRecipient.bairro ?? undefined,
      numero: newRecipient.numero ?? undefined,
      complemento: newRecipient.complemento ?? undefined,
    };

    if (isReverse) {
      setValue("origem", recipientAddress, { shouldDirty: true });
      setValue("origemCep", formattedCep, { shouldValidate: true });
      setOrigemInfo({
        cidade: newRecipient.cidade,
        uf: newRecipient.uf,
        label: newRecipient.name,
        isDefault: false,
      });
      setCepStatus((status) => ({ ...status, origem: true }));
    } else {
      setValue("destino", recipientAddress, { shouldDirty: true });
      setValue("destinoCep", formattedCep, { shouldValidate: true });
      setDestinoInfo({
        cidade: newRecipient.cidade,
        uf: newRecipient.uf,
      });
      setCepStatus((status) => ({ ...status, destino: true }));
    }

    setRecipientModalOpen(false);
    message.success("Destinatário adicionado com sucesso!");
  };

  const handleRecipientSelect = (recipientId: string | null) => {
    setSelectedRecipientId(recipientId);

    if (!recipientId) {
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

    const recipient = recipients.find((r) => r.id === recipientId);
    if (!recipient) return;

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
      });
      setCepStatus((status) => ({ ...status, destino: true }));
    }
  };

  const handleReminderOpen = () => {
    setReminderDraft(lembreteValue ?? "");
    setReminderModalOpen(true);
  };

  const handleReminderSave = () => {
    const trimmed = reminderDraft.trim();
    if (trimmed.length > 40) {
      message.warning("Lembrete deve ter no máximo 40 caracteres.");
      return;
    }
    setValue("lembrete", trimmed || undefined, { shouldDirty: true });
    setReminderModalOpen(false);
  };

  const handleReminderRemove = () => {
    setValue("lembrete", undefined, { shouldDirty: true });
    setReminderDraft("");
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
    lembrete: values.lembrete?.trim() || null,
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
      lembrete: values.lembrete?.trim() || null,
      volumes: values.volumes.map((item) => ({
        comprimentoCm: Number(item.comprimentoCm),
        larguraCm: Number(item.larguraCm),
        alturaCm: Number(item.alturaCm),
        pesoKg: Number(item.pesoKg),
      })),
    };

    try {
      const response = await calculateQuotes.mutateAsync(payload);
      const normalized: QuoteCalculateResponse = Array.isArray(response)
        ? { results: response }
        : response;

      if (!normalized.results.length) {
        message.warning(
          "Nenhum serviço disponível para os parâmetros informados.",
        );
        return;
      }

      const quoteId = crypto.randomUUID();
      const resumo = buildSummary(values);

      setResults({
        quoteId,
        createdAt: new Date().toISOString(),
        resumo,
        results: normalized.results,
        pontosParceiros: normalized.pontosParceiros,
      });

      dispatchTelemetry("quote_form_submit", {
        quoteId,
        volumesCount: values.volumes.length,
        pesoTotalKg: totals.pesoRealKg,
        pesoCubadoTotalKg: totals.pesoCubadoKg,
        coleta: values.coleta,
        devolucao: values.devolucao,
        hasInsuranceValue: Boolean(payload.seguro),
      });

      router.push(`/cotacoes/resultados?quoteId=${quoteId}`);
    } catch (error) {
      console.error("Erro ao calcular cotações", error);
      message.error("Não foi possível calcular as cotações. Tente novamente.");
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
  const destinationManualPlaceholder = isReverse
    ? "00000-000"
    : "00000-000";
  const destinationManualHelper = isReverse
    ? "Informe o CEP de quem enviará a devolução."
    : "Informe o CEP de quem receberá o envio.";
  const routeStepsItems = isReverse
    ? [{ title: "Destinatário" }, { title: "Empresa" }]
    : [{ title: "Origem" }, { title: "Destino" }];
  const companyCardTitle = isReverse ? "2) Destino" : "1) Origem";
  const companyCardSubtitle = isReverse
    ? "Endereço que receberá a devolução."
    : "Endereço onde o envio começa.";
  const clientCardTitle = isReverse ? "1) Origem" : "2) Destino";
  const clientCardSubtitle = isReverse
    ? "Quem enviará a devolução."
    : "Quem receberá o envio.";
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

  const reverseToggle = (
    <Space size={8} align="center">
      <Switch
        checked={isReverse}
        onChange={handleReverseToggle}
        checkedChildren="Reversa"
        unCheckedChildren="Envio"
        disabled={calculateQuotes.isPending}
        aria-label="Alternar Logística Reversa"
      />
      <Typography.Text strong>Logística Reversa</Typography.Text>
    </Space>
  );

  const destinationModeSelector = (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      <Typography.Text strong>{destinoModeLabel}</Typography.Text>
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
      >
        <Radio value="manual">{destinationManualRadioLabel}</Radio>
        <Radio value="recipient">
          {destinationRecipientRadioLabel}
        </Radio>
      </Radio.Group>
    </Space>
  );

  const companyCardContent = (
    <OriginCard
      title={companyCardTitle}
      subtitle={companyCardSubtitle}
      info={isReverse ? destinoInfo : origemInfo}
    >
      <Form.Item
        label="Endereço selecionado"
        required
        colon={false}
        style={{ marginBottom: 0 }}
      >
        <AddressSelect
          value={selectedOriginId}
          onChange={(id) => selectOrigin(id)}
          onAddAddress={handleAddressModalOpen}
          placeholder={origemPlaceholder}
        />
      </Form.Item>
    </OriginCard>
  );

  const clientCardContent = (
    <DestinationCard
      title={clientCardTitle}
      subtitle={clientCardSubtitle}
      info={clientCardInfo}
      modeSelector={destinationModeSelector}
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
            const suffix = clientCepLoading ? (
              <Spin size="small" />
            ) : clientStatus ? (
              <CheckCircleTwoTone twoToneColor="#389e0d" />
            ) : clientCepError ? (
              <CloseCircleTwoTone twoToneColor="#ff4d4f" />
            ) : null;

            return (
              <Form.Item
                label={destinationManualLabel}
                validateStatus={
                  fieldState.error || clientCepError ? "error" : undefined
                }
                help={
                  fieldState.error?.message ||
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
                  placeholder={destinationManualPlaceholder}
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
            onAddRecipient={() => setRecipientModalOpen(true)}
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
        <Card>
          <Space direction="vertical" size={32} style={{ width: "100%" }}>
            <RouteSummaryBar
              origin={summaryOrigin}
              destination={summaryDestination}
              isReverse={isReverse}
              extra={reverseToggle}
            />

            {reverseAlertVisible && reverseAlertMessage ? (
              <Alert
                type="info"
                showIcon
                message={reverseAlertMessage}
              />
            ) : null}

            <RouteModeTag isReverse={isReverse}>
              <Space direction="vertical" size={24} style={{ width: "100%" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <Steps
                    size="small"
                    items={routeStepsItems}
                    current={routeStepsItems.length - 1}
                  />
                </div>

                <RouteCards
                  isReverse={isReverse}
                  originCard={originCardNode}
                  destinationCard={destinationCardNode}
                />
              </Space>
            </RouteModeTag>

            <Row gutter={[32, 24]}>
              <Col xs={24} lg={10}>
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                  <Controller
                    control={control}
                    name="seguroValor"
                    render={({ field, fieldState }) => (
                      <Form.Item
                        label="Valor do seguro (R$)"
                        validateStatus={fieldState.error ? "error" : undefined}
                        help={fieldState.error?.message}
                      >
                        <InputNumber
                          {...field}
                          value={field.value ?? undefined}
                          placeholder="Opcional"
                          min={0}
                          step={100}
                          style={{ width: "100%" }}
                          onChange={(val) => field.onChange(val ?? undefined)}
                        />
                      </Form.Item>
                    )}
                  />

                  <div>
                    <Typography.Title level={5}>Preferências</Typography.Title>
                    <Space
                      direction="vertical"
                      size={12}
                      style={{ width: "100%" }}
                    >
                      <Controller
                        control={control}
                        name="coleta"
                        render={({ field }) => (
                          <Flex align="center" gap={12}>
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
                              <Typography.Text type="secondary">
                                Disponível para CEPs com cobertura de coleta
                              </Typography.Text>
                            </div>
                          </Flex>
                        )}
                      />
                    </Space>
                  </div>

                  <div>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>
                      Lembrete
                    </Typography.Title>
                    {lembreteValue ? (
                      <Space size={8}>
                        <Tag>{lembreteValue}</Tag>
                        <Button type="text" onClick={handleReminderOpen}>
                          Editar
                        </Button>
                        <Button
                          type="text"
                          danger
                          onClick={handleReminderRemove}
                        >
                          Remover
                        </Button>
                      </Space>
                    ) : (
                      <Button type="link" onClick={handleReminderOpen}>
                        Adicionar lembrete
                      </Button>
                    )}
                    <Typography.Paragraph
                      type="secondary"
                      style={{ marginBottom: 0 }}
                    >
                      O lembrete aparece no banner de resultados e na
                      finalização.
                    </Typography.Paragraph>
                  </div>
                </Space>
              </Col>

              <Col xs={24} lg={14}>
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                  <div>
                    <Typography.Title level={4} style={{ marginBottom: 4 }}>
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
                    maxCount={MAX_VOLUMES}
                    totals={totals}
                    disableRemove={calculateQuotes.isPending}
                  />
                </Space>
              </Col>
            </Row>

            <Divider />

            <Flex align="center" justify="space-between" wrap gap={16}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <div>
                  Volumes: <strong>{fields.length}</strong>
                </div>
                <div>
                  Peso total: <strong>{formatKg(totals.pesoRealKg)} kg</strong>
                </div>
                <div>
                  Cubado: <strong>{formatKg(totals.pesoCubadoKg)} kg</strong>
                </div>
              </div>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={calculateQuotes.isPending}
                disabled={!canSubmit}
              >
                {calculateQuotes.isPending
                  ? "Calculando cotações..."
                  : "Calcular"}
              </Button>
            </Flex>
          </Space>
        </Card>
      </Form>

      <Modal
        title="Adicionar lembrete"
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
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          Exibido no banner de resultados e na finalização da cotação.
        </Typography.Paragraph>
      </Modal>

      <AddressModal
        open={addressModalOpen}
        onCancel={() => setAddressModalOpen(false)}
        onSubmit={handleAddressModalSubmit}
      />

      <RecipientModal
        open={recipientModalOpen}
        onCancel={() => setRecipientModalOpen(false)}
        onSubmit={handleRecipientModalSubmit}
      />
    </FormProvider>
  );
}

// Testes manuais:
// - Reversa OFF: preencher CEP do cliente no destino, ativar reversa e verificar Origem=cliente, Destino=empresa.
// - Reversa ON: editar CEP do cliente, desativar reversa e confirmar que Destino permanece cliente e Origem volta a empresa.
// - Alternar ON/OFF várias vezes mantém os dados nas posições corretas sem perda.
// - Cabeçalho, passos, tag e barra-resumo refletem corretamente o fluxo “Empresa → Cliente” e “Cliente → Empresa”.
