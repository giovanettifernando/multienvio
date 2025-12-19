import { Table, Grid } from 'antd';
import type { TableProps } from 'antd';

/**
 * ELTable - Design System v2
 * Wrapper para Table do AntD
 *
 * Para tabelas com paginação e cards mobile, use DataTable.
 * ELTable é para casos que precisam de controle total sobre a Table.
 */
export type ELTableProps<T> = TableProps<T>;

export const ELTable = Table;
export const useBreakpoint = Grid.useBreakpoint;
