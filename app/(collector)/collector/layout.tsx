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
      <Layout>
        <Sider width={240} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={({ key }) => router.push(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            {children}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
