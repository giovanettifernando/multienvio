"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleTwoTone, CloseCircleTwoTone, LoadingOutlined } from "@ant-design/icons";
import { Form, Input, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  Controller,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { maskCEP } from "@/lib/masks";
import type { CepLookupResult } from "@/types/quote";
import type { QuoteFormValues } from "./QuoteForm";

type CepFieldProps = {
  name: FieldPath<QuoteFormValues>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  initialResolved?: { cidade?: string; uf?: string };
  onResolvedChange?: (value: {
    cep: string;
    cidade?: string;
    uf?: string;
  } | null) => void;
};

type ValidationStatus = "idle" | "validating" | "valid" | "error";

export function CepField({
  name,
  label,
  placeholder,
  disabled,
  autoFocus,
  initialResolved,
  onResolvedChange,
}: CepFieldProps) {
  const { control, setError, clearErrors } = useFormContext<QuoteFormValues>();
  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [resolved, setResolved] = useState<
    { cidade?: string; uf?: string } | null
  >(initialResolved ?? null);
  const prevInitialResolved = useRef<string>(
    `${initialResolved?.cidade ?? ""}|${initialResolved?.uf ?? ""}`,
  );
  const lastNotifiedResolved = useRef<string>(
    resolved ? `${resolved.cidade ?? ""}|${resolved.uf ?? ""}` : "",
  );
  const lastValidatedCep = useRef<string | null>(null);

  useEffect(() => {
    const signature = `${initialResolved?.cidade ?? ""}|${initialResolved?.uf ?? ""}`;
    if (signature !== prevInitialResolved.current) {
      prevInitialResolved.current = signature;
      setResolved(initialResolved ?? null);
      lastNotifiedResolved.current = signature;
    }
  }, [initialResolved]);

  const value = (useWatch({ control, name }) as string | undefined) ?? "";
  const maskedValue = useMemo(() => maskCEP(value), [value]);
  const shouldValidate = maskedValue.length === 9;

  const { data, isFetching, error } = useQuery<CepLookupResult>({
    queryKey: ["cep-lookup", maskedValue],
    queryFn: async () => {
      const res = await fetch(`/api/cep/${maskedValue}`);
      if (!res.ok) {
        throw new Error("Falha ao validar CEP.");
      }
      return (await res.json()) as CepLookupResult;
    },
    enabled: shouldValidate,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    const notifyResolvedChange = (next: {
      cep: string;
      cidade?: string;
      uf?: string;
    } | null) => {
      const signature = next
        ? `${next.cep}|${next.cidade ?? ""}|${next.uf ?? ""}`
        : "";
      if (lastNotifiedResolved.current !== signature) {
        lastNotifiedResolved.current = signature;
        onResolvedChange?.(next);
      }
    };

    if (!shouldValidate) {
      lastValidatedCep.current = null;
      if (status !== "idle") setStatus("idle");
      if (resolved !== null) setResolved(null);
      notifyResolvedChange(null);
      clearErrors(name);
      return;
    }

    if (isFetching) {
      setStatus("validating");
      return;
    }

    if (!data && !error) {
      return;
    }

    if (error) {
      if (lastValidatedCep.current !== maskedValue) {
        setStatus("error");
        setResolved(null);
        setError(name, {
          type: "manual",
          message: "Não foi possível validar o CEP.",
        });
        notifyResolvedChange(null);
        lastValidatedCep.current = maskedValue;
      }
      return;
    }

    if (!data) {
      return;
    }

    if (lastValidatedCep.current === maskedValue && status === "valid") {
      return;
    }

    lastValidatedCep.current = maskedValue;

    if (data.valido) {
      clearErrors(name);
      setStatus("valid");
      const resolvedValue = { cidade: data.cidade, uf: data.uf };
      setResolved(resolvedValue);
      notifyResolvedChange({
        cep: maskedValue,
        cidade: data.cidade,
        uf: data.uf,
      });
    } else {
      setStatus("error");
      setResolved(null);
      setError(name, {
        type: "manual",
        message: data.mensagemErro ?? "CEP inválido.",
      });
      notifyResolvedChange(null);
    }
  }, [
    clearErrors,
    data,
    error,
    isFetching,
    maskedValue,
    name,
    onResolvedChange,
    setError,
    shouldValidate,
    status,
    resolved,
  ]);

  const suffix = useMemo(() => {
    const baseStyle = {
      display: "inline-flex",
      width: 18,
      justifyContent: "center",
    } as const;
    if (status === "validating") {
      return (
        <span style={baseStyle}>
          <LoadingOutlined spin />
        </span>
      );
    }
    if (status === "valid") {
      return (
        <span style={baseStyle}>
          <CheckCircleTwoTone twoToneColor="#389e0d" />
        </span>
      );
    }
    if (status === "error") {
      return (
        <span style={baseStyle}>
          <CloseCircleTwoTone twoToneColor="#ff4d4f" />
        </span>
      );
    }
    return <span style={baseStyle} />;
  }, [status]);

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          validateStatus={fieldState.error ? "error" : undefined}
          help={fieldState.error?.message}
          extra={
            resolved?.cidade && resolved?.uf ? (
              <Typography.Text type="secondary">
                {resolved.cidade} / {resolved.uf}
              </Typography.Text>
            ) : null
          }
        >
          <Input
            {...field}
            value={maskedValue}
            maxLength={9}
            placeholder={placeholder ?? "00000-000"}
            suffix={suffix}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="postal-code"
            inputMode="numeric"
            onChange={(event) => {
              const nextValue = maskCEP(event.target.value);
              field.onChange(nextValue);
            }}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
}
