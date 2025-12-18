"use client";

import { Drawer } from 'antd';
import type { DrawerProps } from 'antd';
import { cn } from "@/lib/utils/cn";
import "./ELDrawer.module.css";

export type ELDrawerSize = "sm" | "md" | "lg" | "xl";

export interface ELDrawerProps extends Omit<DrawerProps, "width" | "rootClassName" | "size"> {
  /** Tamanho do drawer */
  drawerSize?: ELDrawerSize;
  /** Remover padding do body */
  noPadding?: boolean;
  /** Fundo branco no body (ao invés de cinza) */
  whiteBg?: boolean;
  /** Classe adicional para o root */
  rootClassName?: string;
}

const sizeWidths: Record<ELDrawerSize, number> = {
  sm: 320,
  md: 480,
  lg: 640,
  xl: 800,
};

/**
 * ELDrawer - Drawer padronizado usando tokens CSS do design system
 *
 * Features:
 * - Estilos consistentes com tokens CSS
 * - Presets de tamanho (sm, md, lg, xl)
 * - Suporte a footer
 * - Responsivo em mobile (full width)
 */
export function ELDrawer({
  drawerSize = "md",
  noPadding = false,
  whiteBg = false,
  placement = "right",
  rootClassName,
  children,
  ...props
}: ELDrawerProps) {
  const drawerClasses = cn(
    "el-drawer",
    `el-drawer-${drawerSize}`,
    placement === "left" && "el-drawer-left",
    placement === "bottom" && "el-drawer-bottom",
    noPadding && "el-drawer-no-padding",
    whiteBg && "el-drawer-white-bg",
    rootClassName
  );

  return (
    <Drawer
      {...props}
      placement={placement}
      styles={{
        wrapper: { width: sizeWidths[drawerSize] },
        ...props.styles,
      }}
      rootClassName={drawerClasses}
    >
      {children}
    </Drawer>
  );
}
