import { cn } from "@/shared/utils/cn";
import styles from "./AppContainer.module.css";

export interface AppContainerProps {
  children: React.ReactNode;
  /** Classe CSS adicional */
  className?: string;
  /** Padding interno customizado */
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  /** Se deve usar altura mínima de 100vh */
  fullHeight?: boolean;
  /** Elemento HTML a ser renderizado */
  as?: "div" | "main" | "section" | "article";
}

/**
 * AppContainer - Wrapper único para largura centralizada e paddings responsivos.
 *
 * Max-width por faixa:
 * - Mobile (<=768px): 100%
 * - Tablet (769-1279px): calc(100% - 32px)
 * - Desktop comum (1280-1439px): 1280px
 * - Desktop grande (1440-1919px): 1400px
 * - Full HD+ (>=1920px): 1600px (para de escalar)
 *
 * Paddings responsivos:
 * - Mobile: 16px
 * - Tablet: 24px
 * - Desktop: 32px
 */
export function AppContainer({
  children,
  className,
  padding = "md",
  fullHeight = false,
  as: Component = "div",
}: AppContainerProps) {
  return (
    <Component
      className={cn(
        styles.container,
        styles[`padding-${padding}`],
        fullHeight && styles.fullHeight,
        className
      )}
    >
      {children}
    </Component>
  );
}

export default AppContainer;
