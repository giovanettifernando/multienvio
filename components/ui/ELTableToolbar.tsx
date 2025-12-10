/**
 * ELTableToolbar - Toolbar padronizada para tabelas
 *
 * Fornece um layout consistente para filtros, busca e ações de tabela.
 */

import React from "react";
import { Input, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ELFlex } from "./ELGrid";
import styles from "./ELTableToolbar.module.css";

export interface ELTableToolbarProps {
  /** Placeholder do campo de busca */
  searchPlaceholder?: string;
  /** Valor atual da busca */
  searchValue?: string;
  /** Callback ao digitar na busca */
  onSearchChange?: (value: string) => void;
  /** Esconder campo de busca */
  hideSearch?: boolean;
  /** Filtros extras (lado esquerdo) */
  filters?: React.ReactNode;
  /** Ações extras (lado direito) */
  actions?: React.ReactNode;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Toolbar padronizada para tabelas
 *
 * @example
 * <ELTableToolbar
 *   searchPlaceholder="Buscar envios..."
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   filters={<StatusFilter value={status} onChange={setStatus} />}
 *   actions={<ELButton onClick={handleExport}>Exportar</ELButton>}
 * />
 */
export function ELTableToolbar({
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  hideSearch = false,
  filters,
  actions,
  className,
}: ELTableToolbarProps) {
  const classes = [styles.toolbar, className].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      <ELFlex justify="between" align="center" gap="md" wrap>
        {/* Lado esquerdo: busca + filtros */}
        <Space wrap size="middle">
          {!hideSearch && (
            <Input
              placeholder={searchPlaceholder}
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              allowClear
              className={styles.searchInput}
            />
          )}
          {filters}
        </Space>

        {/* Lado direito: ações */}
        {actions && (
          <Space wrap size="small">
            {actions}
          </Space>
        )}
      </ELFlex>
    </div>
  );
}
