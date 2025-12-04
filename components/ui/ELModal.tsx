"use client";

import Modal from "antd/es/modal";
import type { ModalProps } from "antd/es/modal";
import { cn } from "@/lib/utils/cn";
import "./ELModal.module.css";

export type ELModalSize = "sm" | "md" | "lg" | "xl" | "fullscreen";

export interface ELModalProps extends Omit<ModalProps, "width" | "wrapClassName"> {
  /** Tamanho do modal */
  size?: ELModalSize;
  /** Esconder footer */
  hideFooter?: boolean;
  /** Centralizar conteúdo */
  centered?: boolean;
  /** Classe adicional para o wrapper */
  wrapClassName?: string;
}

const sizeWidths: Record<ELModalSize, number | string> = {
  sm: 400,
  md: 560,
  lg: 800,
  xl: 1000,
  fullscreen: "calc(100vw - 48px)",
};

/**
 * ELModal - Modal padronizado usando tokens CSS do design system
 *
 * Features:
 * - Estilos consistentes com tokens CSS
 * - Presets de tamanho (sm, md, lg, xl, fullscreen)
 * - Opção para esconder footer
 * - Responsivo em mobile
 */
export function ELModal({
  size = "md",
  hideFooter = false,
  centered = true,
  wrapClassName,
  children,
  ...props
}: ELModalProps) {
  const modalClasses = cn(
    "el-modal",
    `el-modal-${size}`,
    hideFooter && "el-modal-no-footer",
    wrapClassName
  );

  return (
    <Modal
      {...props}
      centered={centered}
      width={sizeWidths[size]}
      wrapClassName={modalClasses}
    >
      {children}
    </Modal>
  );
}
