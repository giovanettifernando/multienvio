import { DatePicker } from 'antd';
import type { DatePickerProps } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import { cn } from "@/shared/utils/cn";
import styles from "./ELDatePicker.module.css";
import locale from 'antd/es/date-picker/locale/pt_BR';

/**
 * ELDatePicker - Design System v2
 * Wrapper para DatePicker do AntD com locale pt-BR e estilos padronizados
 * Inclui variantes: RangePicker
 */

const { RangePicker } = DatePicker;

export interface ELDatePickerProps extends Omit<DatePickerProps, 'locale'> {}

export interface ELRangePickerProps extends Omit<RangePickerProps, 'locale'> {}

function DatePickerBase({
  className,
  popupClassName,
  size,
  format,
  ...props
}: ELDatePickerProps) {
  return (
    <DatePicker
      {...props}
      locale={locale}
      format={format ?? "DD/MM/YYYY"}
      className={cn(styles.datePicker, className)}
      popupClassName={cn(styles.popup, popupClassName)}
      size={size ?? "middle"}
    />
  );
}

function ELRangePicker({
  className,
  popupClassName,
  size,
  format,
  ...props
}: ELRangePickerProps) {
  return (
    <RangePicker
      {...props}
      locale={locale}
      format={format ?? "DD/MM/YYYY"}
      className={cn(styles.datePicker, styles.rangePicker, className)}
      popupClassName={cn(styles.popup, popupClassName)}
      size={size ?? "middle"}
    />
  );
}

// Composed component pattern
type ComposedELDatePicker = typeof DatePickerBase & {
  RangePicker: typeof ELRangePicker;
};

export const ELDatePicker = DatePickerBase as ComposedELDatePicker;
ELDatePicker.RangePicker = ELRangePicker;
