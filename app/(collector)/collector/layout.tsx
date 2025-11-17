'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Dropdown, Spin, App as AntdApp } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useCollectorSession } from '@/stores/useCollectorSession';

const { Header, Sider, Content } = Layout;

const publicPaths = ['/collector/login'];

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  const { message } = AntdApp.useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { collector, setCollector, clearCollector } = useCollectorSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isPublicPath = publicPaths.includes(pathname);

    async function checkSession() {
      if (isPublicPath) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/collector/auth/me');

        if (!response.ok) {
          clearCollector();
          router.replace(`/collector/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const data = await response.json();
        setCollector(data.collector);
      } catch (error) {
        console.error('Session check error:', error);
        clearCollector();
        router.replace(`/collector/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [pathname, router, setCollector, clearCollector]);

  async function handleLogout() {
    try {
      await fetch('/api/collector/auth/logout', { method: 'POST' });
      clearCollector();
      message.success('Logout realizado com sucesso');
      router.replace('/collector/login');
    } catch (error) {
      console.error('Logout error:', error);
      message.error('Erro ao fazer logout');
    }
  }

  // Páginas públicas (sem layout)
  if (publicPaths.includes(pathname)) {
    return <>{children}</>;
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Não autenticado (será redirecionado)
  if (!collector) {
    return null;
  }

  const menuItems = [
    {
      key: '/collector',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/collector/receptions',
      icon: <InboxOutlined />,
      label: 'Fila de Recepções',
    },
    {
      key: '/collector/support',
      icon: <CustomerServiceOutlined />,
      label: 'Suporte',
    },
  ];

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sair',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: '#001529',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
        }}
      >
        <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
          Envio Legal • Ponto de Coleta
        </div>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }}>
            {collector.nomeFantasia}
          </Button>
        </Dropdown>
      </Header>
      <Layout style={{ marginTop: 64 }}>
        <Sider
          width={240}
          style={{
            background: '#fff',
            position: 'fixed',
            left: 0,
            top: 64,
            bottom: 0,
            height: 'calc(100vh - 64px)',
            zIndex: 1000,
            overflow: 'auto',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={({ key }) => router.push(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ marginLeft: 240, padding: '24px', transition: 'margin-left 0.2s' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
      <style jsx global>{`
        /* Responsive adjustments for collector layout */
        @media (max-width: 767px) {
          /* Remove fixed positioning on mobile */
          .ant-layout-header {
            position: relative !important;
          }
          .ant-layout-sider {
            position: relative !important;
            top: 0 !important;
            height: auto !important;
          }
          /* Remove margins on mobile */
          .ant-layout {
            margin-top: 0 !important;
            margin-left: 0 !important;
          }
        }

        @media (min-width: 768px) {
          /* Fixed positioning on desktop */
          .ant-layout-sider {
            position: fixed !important;
            left: 0 !important;
            top: 64px !important;
            bottom: 0 !important;
            height: calc(100vh - 64px) !important;
            z-index: 1000 !important;
          }
        }
      `}</style>
    </Layout>
  );
}
