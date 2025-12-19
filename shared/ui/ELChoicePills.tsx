"use client";

import type { ReactNode } from "react";
import styles from './ELChoicePills.module.css';
import { cn } from "@/shared/utils/cn";

export interface ELChoicePillOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: string;
  icon?: ReactNode;
}

export interface ELChoicePillsProps<T extends string = string> {
  options: ELChoicePillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "small" | "middle";
  className?: string;
}

/**
 * ELChoicePills - Seletor de opções em formato de pills/botões compactos.
 * Substitui radio buttons por uma interface mais tátil e moderna.
 */
export function ELChoicePills<T extends string = string>({
  options,
  value,
  onChange,
  disabled,
  size = "middle",
  className,
}: ELChoicePillsProps<T>) {
  return (
    <div
      className={cn(
        styles.container,
        size === "small" && styles.small,
        disabled && styles.disabled,
        className
      )}
      role="radiogroup"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            className={cn(styles.pill, isSelected && styles.selected)}
            onClick={() => !disabled && onChange(option.value)}
          >
            {option.icon && <span className={styles.icon}>{option.icon}</span>}
            <span className={styles.content}>
              <span className={styles.label}>{option.label}</span>
              {option.description && (
                <span className={styles.description}>{option.description}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
