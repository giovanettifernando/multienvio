'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Dropdown, Spin, App as AntdApp, Drawer } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar tamanho da tela
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
    // Fechar menu mobile após navegar
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const menuComponent = (
    <Menu
      mode="inline"
      selectedKeys={[pathname]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ height: '100%', borderRight: 0 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#001529',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Botão hambúrguer em mobile */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              style={{ color: 'white', fontSize: 20 }}
            />
          )}
          <div style={{ color: 'white', fontSize: isMobile ? 14 : 18, fontWeight: 'bold' }}>
            {isMobile ? 'Envio Legal' : 'Envio Legal • Coletor Autônomo'}
          </div>
        </div>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button
            type="text"
            icon={<UserOutlined />}
            style={{ color: 'white', fontSize: isMobile ? 12 : 14 }}
          >
            {isMobile ? '' : coletor.pfNome}
          </Button>
        </Dropdown>
      </Header>

      <Layout>
        {/* Sidebar Desktop */}
        {!isMobile && (
          <Sider width={240} style={{ background: '#fff' }}>
            {menuComponent}
          </Sider>
        )}

        {/* Drawer Mobile */}
        {isMobile && (
          <Drawer
            title="Menu"
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            width={280}
            styles={{ body: { padding: 0 } }}
          >
            {menuComponent}
          </Drawer>
        )}

        {/* Conteúdo */}
        <Layout style={{ padding: isMobile ? '12px' : '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: isMobile ? 16 : 24,
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
