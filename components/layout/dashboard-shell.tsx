'use client';
import { useAuthStore } from "@/stores/auth";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Typography, Flex, Avatar } from 'antd';
import {
  HomeOutlined,
  FileAddOutlined,
  SearchOutlined,
  CalendarOutlined,
  WalletOutlined,
  CustomerServiceOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { spacing } from "@/lib/ui/theme";

const { Header, Sider, Content } = Layout;

type MenuItem = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  href: string;
};

const NAV_ITEMS: MenuItem[] = [
  { key: 'dashboard', label: 'Visão geral', icon: <HomeOutlined />, href: '/' },
  { key: 'cotacoes', label: 'Cotar envio', icon: <SearchOutlined />, href: '/cotacoes' },
  { key: 'carrinho', label: 'Carrinho', icon: <ShoppingCartOutlined />, href: '/carrinho' },
  { key: 'etiquetas', label: 'Etiquetas', icon: <FileAddOutlined />, href: '/etiquetas' },
  { key: 'shipments', label: 'Gestão de envios', icon: <i className="ri-truck-line" />, href: '/shipments' },
  { key: 'coletas', label: 'Coletas', icon: <CalendarOutlined />, href: '/coletas' },
  { key: 'carteira', label: 'Carteira', icon: <WalletOutlined />, href: '/carteira' },
  { key: 'suporte', label: 'Suporte', icon: <CustomerServiceOutlined />, href: '/suporte' },
  { key: 'minha-conta', label: 'Minha conta', icon: <SettingOutlined />, href: '/minha-conta' },
];

function keyFromPath(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/(dashboard)/(overview)')) return 'dashboard';

  // Verificar correspondência exata primeiro
  const exactMatch = NAV_ITEMS.find(i => i.href === pathname);
  if (exactMatch) return exactMatch.key;

  // Verificar por prefixo (para subrotas)
  const prefixMatch = NAV_ITEMS.find(i => pathname.startsWith(i.href + '/'));
  if (prefixMatch) return prefixMatch.key;

  // Fallback para primeira parte do path
  const first = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return NAV_ITEMS.find(i => i.href.startsWith('/' + first)) ? first : 'dashboard';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const usuario = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.logout);

  const displayName = useMemo(() => usuario?.name ?? 'Usuário', [usuario]);
  const avatarUrl = usuario?.avatarUrl;
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);
  const [collapsed, setCollapsed] = useState(false);
  const selectedKey = useMemo(() => keyFromPath(pathname || '/'), [pathname]);

  // lembra estado do colapso no localStorage (opcional)
  useEffect(() => {
    const saved = globalThis?.localStorage?.getItem('enviolegal:sider-collapsed');
    if (saved != null) setCollapsed(saved === '1');
  }, []);
  useEffect(() => {
    try {
      globalThis?.localStorage?.setItem('enviolegal:sider-collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <Layout style={{ minHeight: '100dvh', background: 'var(--color-background)' }}>
      <Sider
        width={240}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        <Flex
          align="center"
          justify="center"
          style={{
            height: 56,
            padding: `0 ${spacing.lg}px`,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <Typography.Text
            strong
            style={{
              color: 'var(--color-primary)',
              fontSize: 15,
            }}
          >
            {collapsed ? 'EL' : 'Envio Legal'}
          </Typography.Text>
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS.map(item => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.href}>{item.label}</Link>,
          }))}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            height: 56,
            background: '#FFFFFF',
            borderBottom: '1px solid var(--color-border)',
            padding: `0 ${spacing.lg}px`,
          }}
        >
          <Flex align="center" gap={spacing.md} style={{ height: '100%' }}>
            <Button
              type="text"
              aria-label="Alternar menu"
              onClick={() => setCollapsed(v => !v)}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            />
            <Flex align="center" gap={spacing.sm} style={{ marginLeft: 'auto' }}>
              <Avatar size={32} src={avatarUrl ?? undefined} alt={displayName}>
                {!avatarUrl ? avatarInitials : null}
              </Avatar>
              <Typography.Text>{displayName}</Typography.Text>
              <Button
                type="link"
                size="small"
                onClick={() => { clearSession(); router.replace('/login'); }}
              >
                Sair
              </Button>
            </Flex>
          </Flex>
        </Header>
        <Content style={{ padding: spacing.lg }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
