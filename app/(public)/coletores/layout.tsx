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
import { useColetorSession } from '@/stores/useColetorSession';

const { Header, Sider, Content } = Layout;

const publicPaths = ['/coletores/login', '/coletores/cadastro'];

export default function ColetoresLayout({ children }: { children: React.ReactNode }) {
  const { message } = AntdApp.useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { coletor, setColetor, clearColetor } = useColetorSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isPublicPath = publicPaths.includes(pathname);

    async function checkSession() {
      if (isPublicPath) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/coletores/auth/me');

        if (!response.ok) {
          clearColetor();
          router.replace(`/coletores/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const data = await response.json();
        setColetor(data.coletor);
      } catch (error) {
        console.error('Session check error:', error);
        clearColetor();
        router.replace(`/coletores/login?next=${encodeURIComponent(pathname)}`);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [pathname, router, setColetor, clearColetor]);

  async function handleLogout() {
    try {
      await fetch('/api/coletores/auth/logout', { method: 'POST' });
      clearColetor();
      message.success('Logout realizado com sucesso');
      router.replace('/coletores/login');
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
  if (!coletor) {
    return null;
  }

  const menuItems = [
    {
      key: '/coletores',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/coletores/coletas',
      icon: <InboxOutlined />,
      label: 'Fila de Coletas',
    },
    {
      key: '/coletores/suporte',
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
          Envio Legal • Coletor Autônomo
        </div>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }}>
            {coletor.pfNome}
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
