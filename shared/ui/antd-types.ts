/**
 * antd-types.ts - Design System v2
 *
 * Reexporta tipos do AntD para uso no código da aplicação.
 * Isso permite que arquivos fora de shared/ui usem tipos do AntD
 * sem importar diretamente de 'antd'.
 */

// Table types
export type { TableProps, TableColumnsType } from 'antd';
export type { TableRowSelection } from 'antd/es/table/interface';

// Upload types
export type { UploadFile, UploadProps } from 'antd';
export type { RcFile } from 'antd/es/upload';

// Input types
export type { InputRef } from 'antd/es/input';

// Menu types
export type { MenuProps } from 'antd';

// Message types
export type { MessageInstance } from 'antd/es/message/interface';

// Theme types
export type { GlobalToken } from 'antd';

// Form types
export type { FormProps, FormItemProps, FormInstance } from 'antd';

// Common component types
export type {
  ButtonProps,
  InputProps,
  SelectProps,
  CheckboxProps,
  RadioProps,
  SwitchProps,
  DatePickerProps,
  InputNumberProps,
  ModalProps,
  DrawerProps,
  CardProps,
  TagProps,
  AlertProps,
  SpinProps,
  SkeletonProps,
  EmptyProps,
  TabsProps,
  CollapseProps,
  PopconfirmProps,
  TooltipProps,
  DescriptionsProps,
  DividerProps,
  SpaceProps,
  StatisticProps,
} from 'antd';
