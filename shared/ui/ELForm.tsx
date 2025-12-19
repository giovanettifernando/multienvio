import { Form } from 'antd';
import type { FormProps, FormItemProps } from 'antd';

/**
 * ELForm - Design System v2
 * Wrapper para Form do AntD
 */
export type ELFormProps = FormProps;
export type ELFormItemProps = FormItemProps;

export const ELForm = Form;
export const useELForm = Form.useForm;
