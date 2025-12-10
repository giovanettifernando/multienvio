'use client';

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Layout, theme, Button, Flex } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { UserPanel } from './UserPanel';
import { sidebarItems } from './sidebar-items';
import type { MenuProps } from 'antd';

const { Header, Content } = Layout;

// Hook para detectar viewport mobile de forma reativa
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    () => (typeof window !== 'undefined' ? window.innerWidth < 768 : false),
    () => false
  );
}

// Ler collapse state do localStorage de forma síncrona
function getInitialCollapsed(): boolean {
  if (typeof globalThis === 'undefined' || !globalThis.localStorage) return false;
  const saved = globalThis.localStorage.getItem('enviolegal:sider-collapsed');
  return saved === '1';
}

function keyFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return 'overview';

  // Match exact path
  const exactMatch = sidebarItems.find((i) => i.href === pathname);
  if (exactMatch) return exactMatch.key;

  // Match by prefix (for subroutes like /cotacoes/finalizar)
  const prefixMatch = sidebarItems.find((i) => pathname.startsWith(i.href + '/'));
  if (prefixMatch) return prefixMatch.key;

  // Fallback
  return 'overview';
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();

  const selectedKey = useMemo(() => keyFromPath(pathname || '/'), [pathname]);

  // Persistir collapse state
  useEffect(() => {
    try {
      globalThis?.localStorage?.setItem('enviolegal:sider-collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  // Fechar menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Build menu items for mobile drawer
  const mobileMenuItems: MenuProps['items'] = useMemo(() => {
    return sidebarItems.map((item) => {
      const IconComponent = item.icon;
      return {
        key: item.key,
        icon: <IconComponent />,
        label: item.label,
        onClick: () => {
          router.push(item.href);
          setMobileMenuOpen(false);
        },
      };
    });
  }, [router]);

  // Logo for mobile drawer
  const mobileLogo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/logo-envio-legal-branca.svg"
      alt="Envio Legal"
      style={{ width: 140, height: 'auto', maxHeight: 36 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      {/* Desktop: mostrar sidebar fixa */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      )}

      {/* Mobile: drawer menu */}
      {isMobile && (
        <MobileDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          items={mobileMenuItems}
          selectedKeys={[selectedKey]}
          logo={mobileLogo}
          header={<UserPanel collapsed={false} />}
          theme="dark"
        />
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 280,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* Mobile Header with hamburger */}
        {isMobile && (
          <Header
            style={{
              background: token.colorBgContainer,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
              padding: '0 16px',
              height: 64,
              lineHeight: '64px',
              position: 'sticky',
              top: 0,
              zIndex: 100,
            }}
          >
            <Flex align="center" justify="space-between" style={{ height: '100%' }}>
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 20 }} />}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                style={{ width: 44, height: 44 }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/logo-envio-legal.svg"
                alt="Envio Legal"
                style={{ height: 28 }}
              />
              {/* Placeholder para equilibrar o layout */}
              <div style={{ width: 44 }} />
            </Flex>
          </Header>
        )}
        <Content
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: token.colorBgLayout,
            minHeight: isMobile ? 'calc(100dvh - 64px)' : '100dvh',
            overflowY: 'auto',
          }}
        >
          {/* Container responsivo com max-width para telas grandes */}
          <div
            className="el-container"
            style={{
              flex: 1,
              paddingTop: isMobile ? '16px' : '24px',
              paddingBottom: '24px',
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
