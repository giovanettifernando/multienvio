"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input, Spin, Typography } from "antd";
import { useRecurringItemsAutocomplete } from "@/hooks/useRecurringItemsAutocomplete";
import styles from "./RecurringItemAutocomplete.module.css";

interface RecurringItemAutocompleteInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (descricao: string, valorUnitario: number) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RecurringItemAutocompleteInput({
  value = "",
  onChange,
  onSelect,
  placeholder = "Ex.: Camiseta algodão",
  disabled,
}: RecurringItemAutocompleteInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { suggestions, loading, searchItems } = useRecurringItemsAutocomplete();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef(false);

  // Sincronizar com valor externo APENAS quando não estiver digitando
  useEffect(() => {
    if (!isUserTypingRef.current) {
      setInternalValue(value);
    }
  }, [value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isUserTypingRef.current = true;
    setInternalValue(newValue);
    onChange?.(newValue);

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce de 300ms
    if (newValue.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        searchItems(newValue);
        setShowSuggestions(true);
        isUserTypingRef.current = false;
      }, 300);
    } else {
      setShowSuggestions(false);
      isUserTypingRef.current = false;
    }
  }, [onChange, searchItems]);

  const handleSuggestionClick = useCallback((descricao: string, valorUnitario: number) => {
    isUserTypingRef.current = false;
    setInternalValue(descricao);
    onChange?.(descricao);
    onSelect?.(descricao, valorUnitario);
    setShowSuggestions(false);
  }, [onChange, onSelect]);

  const handleFocus = useCallback(() => {
    if (internalValue.trim().length >= 2 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [internalValue, suggestions.length]);

  return (
    <div ref={wrapperRef} className={styles.autocompleteWrapper}>
      <Input
        value={internalValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        suffix={
          <div style={{ width: 16, height: 16, display: 'inline-block' }}>
            {loading && <Spin size="small" />}
          </div>
        }
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className={styles.suggestionsDropdown}>
          {suggestions.map((item) => (
            <div
              key={item.id}
              className={styles.suggestionItem}
              onClick={() => handleSuggestionClick(item.descricao, item.valorUnitario)}
            >
              <Typography.Text className={styles.suggestionText}>
                {item.descricao}
              </Typography.Text>
              <Typography.Text type="secondary" className={styles.suggestionPrice}>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(item.valorUnitario)}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
