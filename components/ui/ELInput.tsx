import { Input } from 'antd';
import type { InputProps, InputRef } from 'antd';
import type { PasswordProps, TextAreaProps } from 'antd/es/input';
import { SearchOutlined } from "@ant-design/icons";
import type { ForwardRefExoticComponent, RefAttributes, KeyboardEvent } from "react";
import { forwardRef, useCallback } from "react";
import { cn } from "@/lib/utils/cn";
import styles from "./ELInput.module.css";

/**
 * Props for ELInput.Search component
 * Uses standard Input with search icon suffix instead of Input.Search
 * for a modern, clean appearance without the separate button
 */
export interface ELSearchProps extends Omit<InputProps, 'suffix'> {
  /** Callback when search is triggered (Enter key) */
  onSearch?: (value: string) => void;
}

type ComposedELInput = ForwardRefExoticComponent<
  InputProps & RefAttributes<HTMLInputElement>
> & {
  Password: ForwardRefExoticComponent<
    PasswordProps & RefAttributes<InputRef>
  >;
  TextArea: ForwardRefExoticComponent<
    TextAreaProps & RefAttributes<HTMLTextAreaElement>
  >;
  Search: ForwardRefExoticComponent<
    ELSearchProps & RefAttributes<InputRef>
  >;
};

const BaseInput = forwardRef<InputRef, InputProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        className={cn(styles.input, className)}
        size={size ?? "middle"}
      />
    );
  },
);
BaseInput.displayName = "ELInput";

const PasswordInput = forwardRef<InputRef, PasswordProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <Input.Password
        {...props}
        ref={ref}
        className={cn(styles.password, className)}
        size={size ?? "middle"}
      />
    );
  },
);
PasswordInput.displayName = "ELInput.Password";

const TextAreaInput = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input.TextArea
        {...props}
        ref={ref}
        className={cn(styles.input, className)}
        autoSize={props.autoSize ?? { minRows: 3, maxRows: 6 }}
      />
    );
  },
);
TextAreaInput.displayName = "ELInput.TextArea";

/**
 * Modern search input with icon inside (suffix)
 * - Clean, single border design (no separate button)
 * - Responsive: max-width on desktop, 100% on mobile
 * - allowClear enabled by default
 */
const SearchInput = forwardRef<InputRef, ELSearchProps>(
  ({ className, onSearch, onKeyDown, ...props }, ref) => {
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch((e.target as HTMLInputElement).value);
      }
      onKeyDown?.(e);
    }, [onSearch, onKeyDown]);

    return (
      <Input
        {...props}
        ref={ref}
        className={cn(styles.search, className)}
        suffix={<SearchOutlined />}
        allowClear={props.allowClear ?? true}
        onKeyDown={handleKeyDown}
      />
    );
  },
);
SearchInput.displayName = "ELInput.Search";

export const ELInput = BaseInput as ComposedELInput;
ELInput.Password = PasswordInput;
ELInput.TextArea = TextAreaInput;
ELInput.Search = SearchInput;
