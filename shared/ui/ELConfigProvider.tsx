import { ConfigProvider } from 'antd';
import type { ConfigProviderProps } from 'antd';
import ptBR from 'antd/locale/pt_BR';

/**
 * ELConfigProvider - Design System v2
 * Wrapper para ConfigProvider do AntD com locale pt-BR configurado
 */
export type ELConfigProviderProps = ConfigProviderProps;

export const ELConfigProvider = ConfigProvider;
export const ELLocale = { ptBR };
