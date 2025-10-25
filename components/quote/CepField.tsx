"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircleTwoTone, CloseCircleTwoTone, LoadingOutlined } from "@ant-design/icons";
import { Form, Input, Typography } from "antd";
import {
  Controller,
  useFormContext,
  useWatch,
  type FieldPath,
} from "react-hook-form";
import { useCepLookup } from "@/hooks/useCepLookup";
import { formatCep, normalizeCep } from "@/lib/services/brasilapi";
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
  const maskedValue = useMemo(() => formatCep(value), [value]);

  // Usa o hook useCepLookup com consulta direta à BrasilAPI
  const { isLoading: isFetching, data: cepData, error: cepError } = useCepLookup(value, {
    onSuccess: (data) => {
      // Atualiza status quando CEP é resolvido
      setStatus("valid");
      const resolvedValue = { cidade: data.city, uf: data.state };
      setResolved(resolvedValue);
      clearErrors(name);
    },
    onError: (error) => {
      // Atualiza status quando há erro
      setStatus("error");
      setResolved(null);
      setError(name, {
        type: "manual",
        message: error.message,
      });
    },
  });

  const data = cepData
    ? {
        valido: true,
        cep: cepData.cep,
        cidade: cepData.city,
        uf: cepData.state,
      }
    : null;

  const error = cepError;

  useEffect(() => {
    // Notifica mudanças de CEP resolvido
    if (data && resolved) {
      const signature = `${data.cep}|${resolved.cidade ?? ""}|${resolved.uf ?? ""}`;
      if (lastNotifiedResolved.current !== signature) {
        lastNotifiedResolved.current = signature;
        onResolvedChange?.({
          cep: data.cep,
          cidade: resolved.cidade,
          uf: resolved.uf,
        });
      }
    } else if (!data && !isFetching) {
      // CEP vazio ou inválido - limpa estado
      if (lastNotifiedResolved.current !== "") {
        lastNotifiedResolved.current = "";
        onResolvedChange?.(null);
      }
      if (status !== "idle" && !error) {
        setStatus("idle");
      }
    }

    // Atualiza status de loading
    if (isFetching && status !== "validating") {
      setStatus("validating");
    }
  }, [data, resolved, isFetching, error, status, onResolvedChange]);

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
              const nextValue = normalizeCep(event.target.value);
              field.onChange(nextValue);
            }}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
}
