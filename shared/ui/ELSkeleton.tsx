import { Skeleton } from 'antd';
import type { SkeletonProps } from 'antd';
import { cn } from "@/shared/utils/cn";
import styles from "./ELSkeleton.module.css";

export interface ELSkeletonProps extends SkeletonProps {
  /** Número de linhas (alias para paragraph.rows) */
  lines?: number;
}

// Re-export Skeleton sub-components
export const ELSkeletonInput = Skeleton.Input;
export const ELSkeletonButton = Skeleton.Button;
export const ELSkeletonAvatar = Skeleton.Avatar;
export const ELSkeletonImage = Skeleton.Image;
export const ELSkeletonNode = Skeleton.Node;

export function ELSkeleton({
  active,
  paragraph,
  title,
  lines,
  className,
  ...props
}: ELSkeletonProps) {
  // Se lines foi especificado, criar paragraph config
  const effectiveParagraph = paragraph ?? (lines ? { rows: lines } : {
    rows: 3,
    width: ["92%", "88%", "76%"],
  });

  return (
    <Skeleton
      {...props}
      active={active ?? true}
      paragraph={effectiveParagraph}
      title={title ?? { width: "60%" }}
      className={cn(styles.skeleton, className)}
    />
  );
}
