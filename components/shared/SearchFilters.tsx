/**
 * SearchFilters - Componente padrão para filtros de busca
 */
import React from "react";
import { Input, Select, Flex, Button } from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { spacing } from "@/lib/ui/theme";

interface SearchFiltersProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: { label: string; value: string }[];
    placeholder?: string;
  }[];
  onReset?: () => void;
  extra?: React.ReactNode;
}

export function SearchFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  onReset,
  extra,
}: SearchFiltersProps) {
  return (
    <Flex gap={spacing.md} wrap="wrap" align="center">
      {onSearchChange && (
        <Input
          prefix={<SearchOutlined />}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
      )}
      {filters?.map((filter, index) => (
        <Select
          key={index}
          value={filter.value}
          onChange={filter.onChange}
          options={filter.options}
          placeholder={filter.placeholder}
          style={{ width: 180 }}
        />
      ))}
      {onReset && (
        <Button icon={<ReloadOutlined />} onClick={onReset}>
          Resetar
        </Button>
      )}
      {extra && <div style={{ marginLeft: "auto" }}>{extra}</div>}
    </Flex>
  );
}
