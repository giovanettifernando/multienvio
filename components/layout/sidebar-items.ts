import {
  HomeOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  FileAddOutlined,
  ReconciliationOutlined,
  CalendarOutlined,
  WalletOutlined,
  CustomerServiceOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { AntdIconProps } from '@ant-design/icons/lib/components/AntdIcon';

type IconComponent = ForwardRefExoticComponent<Omit<AntdIconProps, 'ref'> & RefAttributes<HTMLSpanElement>>;

export interface SidebarItem {
  key: string;
  icon: IconComponent;
  label: string;
  href: string;
}

export const sidebarItems: SidebarItem[] = [
  {
    key: 'overview',
    icon: HomeOutlined,
    label: 'Visão geral',
    href: '/',
  },
  {
    key: 'quote',
    icon: SearchOutlined,
    label: 'Cotar envio',
    href: '/cotacoes',
  },
  {
    key: 'cart',
    icon: ShoppingCartOutlined,
    label: 'Carrinho',
    href: '/carrinho',
  },
  {
    key: 'labels',
    icon: FileAddOutlined,
    label: 'Etiquetas',
    href: '/etiquetas',
  },
  {
    key: 'shipments',
    icon: ReconciliationOutlined,
    label: 'Meus Envios',
    href: '/shipments',
  },
  {
    key: 'pickups',
    icon: CalendarOutlined,
    label: 'Coletas',
    href: '/coletas',
  },
  {
    key: 'wallet',
    icon: WalletOutlined,
    label: 'Carteira',
    href: '/carteira',
  },
  {
    key: 'support',
    icon: CustomerServiceOutlined,
    label: 'Suporte',
    href: '/suporte',
  },
  {
    key: 'account',
    icon: SettingOutlined,
    label: 'Minha conta',
    href: '/minha-conta',
  },
];
