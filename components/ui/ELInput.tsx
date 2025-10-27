import type {
  InputProps,
  PasswordProps,
  TextAreaProps,
  InputRef,
} from "antd/es/input";
import Input from "antd/es/input";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { forwardRef } from "react";
import { NEW_THEME_ENABLED } from "@/lib/features/new-theme";
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
};

const BaseInput = forwardRef<InputRef, InputProps>(
  ({ className, size, ...props }, ref) => {
    if (!NEW_THEME_ENABLED) {
      return (
        <Input
          {...props}
          className={className}
          ref={ref}
          size={size}
        />
      );
    }

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
    if (!NEW_THEME_ENABLED) {
      return (
        <Input.Password
          {...props}
          className={className}
          ref={ref}
          size={size}
        />
      );
    }

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
    if (!NEW_THEME_ENABLED) {
      return (
        <Input.TextArea
          {...props}
          className={className}
          ref={ref}
        />
      );
    }

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

export const ELInput = BaseInput as ComposedELInput;
ELInput.Password = PasswordInput;
ELInput.TextArea = TextAreaInput;
