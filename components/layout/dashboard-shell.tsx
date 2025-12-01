'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Layout, theme, Button, Flex } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Sidebar } from './Sidebar';

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

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const isMobile = useIsMobile();

  // Persistir collapse state
  useEffect(() => {
    try {
      globalThis?.localStorage?.setItem('enviolegal:sider-collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed]);

  return (
    <Layout style={{ minHeight: '100dvh' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
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
            }}
          >
            <Flex align="center" style={{ height: '100%' }}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                aria-label="Toggle menu"
              />
            </Flex>
          </Header>
        )}
        <Content
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: token.colorBgLayout,
            height: isMobile ? 'calc(100vh - 64px)' : '100vh',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0 24px 24px',
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
