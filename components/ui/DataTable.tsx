'use client';

import React, { useMemo } from 'react';
import Table from 'antd/es/table';
import type { TableProps } from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Empty from 'antd/es/empty';
import Pagination from 'antd/es/pagination';
import { cn } from '@/lib/utils/cn';
import { ELSkeleton } from './ELSkeleton';
import { ELEmpty } from './ELEmpty';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  /** Título da coluna */
  title: string;
  /** Chave do dado ou render custom */
  dataIndex?: keyof T | string;
  /** Key única */
  key: string;
  /** Largura fixa */
  width?: number | string;
  /** Renderização customizada */
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  /** Se deve mostrar no card mode mobile */
  showInCard?: boolean;
  /** Label customizado para card mode */
  cardLabel?: string;
  /** Se é coluna de ações */
  isActions?: boolean;
  /** Se é coluna fixa */
  fixed?: 'left' | 'right';
  /** Ordenação */
  sorter?: boolean | ((a: T, b: T) => number);
  /** Ellipsis */
  ellipsis?: boolean;
}

export interface DataTableProps<T extends object> {
  /** Dados da tabela */
  data: T[];
  /** Configuração das colunas */
  columns: DataTableColumn<T>[];
  /** Chave única para cada linha */
  rowKey: keyof T | ((record: T) => string);
  /** Estado de loading */
  loading?: boolean;
  /** Tamanho compacto */
  compact?: boolean;
  /** Habilitar modo card em mobile */
  enableMobileCards?: boolean;
  /** Configuração de paginação */
  pagination?: {
    current?: number;
    pageSize?: number;
    total?: number;
    onChange?: (page: number, pageSize: number) => void;
    showSizeChanger?: boolean;
    showTotal?: (total: number) => React.ReactNode;
  } | false;
  /** Scroll horizontal */
  scrollX?: number | string;
  /** Mensagem de empty state */
  emptyMessage?: string;
  /** Descrição do empty state */
  emptyDescription?: string;
  /** Callback para linha expandível */
  expandable?: TableProps<T>['expandable'];
  /** Classe customizada */
  className?: string;
  /** Locale customizado */
  locale?: TableProps<T>['locale'];
}

/**
 * DataTable - Componente de tabela responsivo com suporte a card mode mobile
 *
 * Características:
 * - Usa tokens CSS para espaçamento e cores
 * - Modo compacto opcional
 * - Card mode automático em telas pequenas (< 480px)
 * - Scroll horizontal em telas médias
 * - Loading e empty states padronizados
 */
export function DataTable<T extends object>({
  data,
  columns,
  rowKey,
  loading = false,
  compact = false,
  enableMobileCards = true,
  pagination,
  scrollX = 'max-content',
  emptyMessage = 'Nenhum registro encontrado',
  emptyDescription,
  expandable,
  className,
  locale,
}: DataTableProps<T>) {
  // Converter colunas para formato Ant Design
  const antColumns: ColumnsType<T> = useMemo(
    () =>
      columns.map((col) => ({
        title: col.title,
        dataIndex: col.dataIndex as string,
        key: col.key,
        width: col.width,
        render: col.render,
        fixed: col.fixed,
        sorter: col.sorter,
        ellipsis: col.ellipsis,
      })),
    [columns]
  );

  // Colunas para card mode (excluindo ações)
  const cardColumns = useMemo(
    () => columns.filter((col) => col.showInCard !== false && !col.isActions),
    [columns]
  );

  // Coluna de ações
  const actionsColumn = useMemo(
    () => columns.find((col) => col.isActions),
    [columns]
  );

  // Função para obter valor aninhado
  const getValue = (record: T, dataIndex?: keyof T | string): unknown => {
    if (!dataIndex) return null;
    const keys = String(dataIndex).split('.');
    let value: unknown = record;
    for (const key of keys) {
      value = (value as Record<string, unknown>)?.[key];
    }
    return value;
  };

  // Renderizar loading
  if (loading && data.length === 0) {
    return (
      <div className={styles.loading}>
        <ELSkeleton />
      </div>
    );
  }

  // Renderizar empty state
  if (!loading && data.length === 0) {
    return (
      <div className={styles.empty}>
        <ELEmpty title={emptyMessage} description={emptyDescription} />
      </div>
    );
  }

  // Key function
  const getRowKey = (record: T): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return String(record[rowKey]);
  };

  return (
    <div
      className={cn(
        enableMobileCards && styles.mobileCards,
        className
      )}
    >
      {/* Tabela para telas maiores */}
      <div className={styles.tableContainer}>
        <Table<T>
          className={cn(styles.table, compact && styles.compact)}
          columns={antColumns}
          dataSource={data}
          rowKey={getRowKey}
          loading={loading}
          pagination={
            pagination === false
              ? false
              : {
                  current: pagination?.current,
                  pageSize: pagination?.pageSize ?? 10,
                  total: pagination?.total ?? data.length,
                  onChange: pagination?.onChange,
                  showSizeChanger: pagination?.showSizeChanger ?? true,
                  showTotal: pagination?.showTotal,
                }
          }
          scroll={{ x: scrollX }}
          expandable={expandable}
          locale={
            locale ?? {
              emptyText: <Empty description={emptyMessage} />,
            }
          }
        />
      </div>

      {/* Card list para mobile */}
      {enableMobileCards && (
        <div className={styles.cardList}>
          {data.map((record, recordIndex) => (
            <div key={getRowKey(record)} className={styles.card}>
              {cardColumns.map((col) => {
                const value = getValue(record, col.dataIndex);
                const rendered = col.render
                  ? col.render(value, record, recordIndex)
                  : value;

                return (
                  <div key={col.key} className={styles.cardRow}>
                    <span className={styles.cardLabel}>
                      {col.cardLabel ?? col.title}
                    </span>
                    <span className={styles.cardValue}>{rendered as React.ReactNode}</span>
                  </div>
                );
              })}

              {actionsColumn && (
                <div className={styles.cardActions}>
                  {actionsColumn.render?.(null, record, recordIndex)}
                </div>
              )}
            </div>
          ))}

          {/* Paginação para card mode */}
          {pagination !== false && (
            <Pagination
              current={pagination?.current}
              pageSize={pagination?.pageSize ?? 10}
              total={pagination?.total ?? data.length}
              onChange={pagination?.onChange}
              showSizeChanger={pagination?.showSizeChanger ?? true}
              showTotal={pagination?.showTotal}
              style={{ marginTop: 16, textAlign: 'center' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
