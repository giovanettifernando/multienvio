'use client';
import { useAuthStore } from "@/stores/auth";

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Typography } from 'antd';
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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const usuario = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.logout);

  const displayName = useMemo(() => usuario?.name ?? 'Usuário', [usuario]);
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
    <Layout style={{ minHeight: '100dvh', background: 'var(--bg, #f5f7fb)' }}>
      <Sider
        width={240}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ height: 56, display: 'flex', alignItems: 'center', paddingInline: 16, gap: 8 }}>
          <Typography.Text strong>{collapsed ? 'EL' : 'Envio Legal'}</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={NAV_ITEMS.map(item => ({
            key: item.key,
            icon: item.icon,
            label: <Link href={item.href}>{item.label}</Link>,
          }))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            height: 56,
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            paddingInline: 16,
            gap: 12,
          }}
        >
          <Button
            type="text"
            aria-label="Alternar menu"
            onClick={() => setCollapsed(v => !v)}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text>{displayName}</Typography.Text>
            <Button type="link" size="small" onClick={() => { clearSession(); router.replace('/login'); }}>
              Sair
            </Button>
          </div>
        </Header>
        <Content style={{ padding: 16 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
