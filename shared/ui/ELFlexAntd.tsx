import { Flex } from 'antd';
import type { FlexProps } from 'antd';

/**
 * ELFlexAntd - Design System v2
 * Wrapper para Flex do AntD
 *
 * Nota: ELFlex em ELGrid.tsx é uma implementação CSS customizada.
 * Este wrapper expõe o Flex nativo do AntD quando necessário.
 */
export type ELFlexAntdProps = FlexProps;

export const ELFlexAntd = Flex;
