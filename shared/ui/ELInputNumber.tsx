import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELInputNumber.module.css";

/**
 * ELInputNumber - Design System v2
 * Wrapper para InputNumber do AntD com estilos padronizados
 * Suporta formatação BRL nativa
 */
export type ELInputNumberVariant = "default" | "currency" | "percentage";

export interface ELInputNumberProps extends Omit<InputNumberProps, 'variant'> {
  variant?: ELInputNumberVariant;
}

// Formatadores para moeda brasileira
const currencyFormatter = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const currencyParser = (value: string | undefined) => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;
};

// Formatadores para porcentagem
const percentFormatter = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return '';
  return `${value}`;
};

const percentParser = (value: string | undefined) => {
  if (!value) return 0;
  return parseFloat(value.replace('%', '').replace(',', '.')) || 0;
};

export function ELInputNumber({
  variant = "default",
  className,
  size,
  formatter,
  parser,
  prefix,
  suffix,
  decimalSeparator,
  ...props
}: ELInputNumberProps) {
  // Aplicar formatadores baseados na variante
  let computedFormatter = formatter;
  let computedParser = parser;
  let computedPrefix = prefix;
  let computedSuffix = suffix;
  let computedDecimalSeparator = decimalSeparator;

  if (variant === "currency" && !formatter) {
    computedFormatter = currencyFormatter;
    computedParser = currencyParser;
    computedPrefix = computedPrefix ?? "R$";
    computedDecimalSeparator = computedDecimalSeparator ?? ",";
  } else if (variant === "percentage" && !formatter) {
    computedFormatter = percentFormatter;
    computedParser = percentParser;
    computedSuffix = computedSuffix ?? "%";
  }

  return (
    <InputNumber
      {...props}
      formatter={computedFormatter}
      parser={computedParser}
      prefix={computedPrefix}
      suffix={computedSuffix}
      decimalSeparator={computedDecimalSeparator}
      className={cn(styles.inputNumber, className)}
      size={size ?? "middle"}
    />
  );
}
