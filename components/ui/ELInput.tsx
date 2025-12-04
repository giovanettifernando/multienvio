import type {
  InputProps,
  PasswordProps,
  TextAreaProps,
  SearchProps,
  InputRef,
} from "antd/es/input";
import Input from "antd/es/input";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";
import styles from "./ELInput.module.css";

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
    SearchProps & RefAttributes<InputRef>
  >;
};

const BaseInput = forwardRef<InputRef, InputProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        className={cn(styles.input, className)}
        size={size ?? "large"}
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
        size={size ?? "large"}
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

const SearchInput = forwardRef<InputRef, SearchProps>(
  ({ className, size, ...props }, ref) => {
    return (
      <Input.Search
        {...props}
        ref={ref}
        className={cn(styles.search, className)}
        size={size ?? "large"}
      />
    );
  },
);
SearchInput.displayName = "ELInput.Search";

export const ELInput = BaseInput as ComposedELInput;
ELInput.Password = PasswordInput;
ELInput.TextArea = TextAreaInput;
ELInput.Search = SearchInput;
