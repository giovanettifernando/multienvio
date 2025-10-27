import type { SkeletonProps } from "antd/es/skeleton";
import Skeleton from "antd/es/skeleton";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
import { cn } from "@/lib/utils/cn";
import styles from "./ELSkeleton.module.css";

export function ELSkeleton({
  active,
  paragraph,
  title,
  className,
  ...props
}: SkeletonProps) {
  if (!NEW_THEME_ENABLED) {
    return <Skeleton {...props} active={active} paragraph={paragraph} title={title} className={className} />;
  }

  return (
    <Skeleton
      {...props}
      active={active ?? true}
      paragraph={
        paragraph ?? {
          rows: 3,
          width: ["92%", "88%", "76%"],
        }
      }
      title={title ?? { width: "60%" }}
      className={cn(styles.skeleton, className)}
    />
  );
}
