'use client';

import { useState, useEffect } from 'react';
import { Layout, theme, Button, Flex } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Sidebar } from './Sidebar';

const { Header, Content } = Layout;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Remember collapse state in localStorage
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
    <Layout style={{ minHeight: '100dvh' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <Layout>
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
            padding: 24,
            background: token.colorBgLayout,
            minHeight: '100vh',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
