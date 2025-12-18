"use client";

import { useState, useEffect, startTransition } from "react";
import { AutoComplete, Input, Typography } from "antd";
import { useRecurringItemsAutocomplete } from "@/modules/shipments/ui/hooks/useRecurringItemsAutocomplete";

interface RecurringItemAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (value: string, valorUnitario?: number) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function RecurringItemAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Digite a descrição do item",
  disabled,
  style,
}: RecurringItemAutocompleteProps) {
  const [searchValue, setSearchValue] = useState(value || "");
  const { suggestions, loading, searchItems } = useRecurringItemsAutocomplete();

  useEffect(() => {
    startTransition(() => {
      setSearchValue(value || "");
    });
  }, [value]);

  const handleSearch = (searchText: string) => {
    setSearchValue(searchText);
    onChange?.(searchText);
    searchItems(searchText);
  };

  const handleSelect = (selectedValue: string) => {
    const selected = suggestions.find((item) => item.descricao === selectedValue);
    setSearchValue(selectedValue);
    onChange?.(selectedValue);

    if (selected && onSelect) {
      onSelect(selected.descricao, selected.valorUnitario);
    }
  };

  const options = suggestions.map((item) => ({
    value: item.descricao,
    label: (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <Typography.Text>{item.descricao}</Typography.Text>
        <Typography.Text type="secondary">
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(item.valorUnitario)}
        </Typography.Text>
      </div>
    ),
  }));

  return (
    <AutoComplete
      value={searchValue}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      disabled={disabled}
      style={style}
      notFoundContent={loading ? "Carregando..." : null}
    >
      <Input placeholder={placeholder} />
    </AutoComplete>
  );
}
