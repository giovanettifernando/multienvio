'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Dropdown, Spin, App as AntdApp, Drawer } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  CustomerServiceOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useColetorSession } from '@/stores/useColetorSession';

const { Header, Sider, Content } = Layout;

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

// Hook para detectar tela pequena (1366x768)
function useIsSmallDesktop(): boolean {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('resize', callback);
      return () => window.removeEventListener('resize', callback);
    },
    () => (typeof window !== 'undefined' ? window.innerWidth >= 768 && window.innerWidth <= 1366 : false),
    () => false
  );
}

const publicPaths = ['/coletores/login', '/coletores/cadastro'];

export default function ColetoresLayoutClient({ children }: { children: React.ReactNode }) {
  const { message } = AntdApp.useApp();
  const pathname = usePathname();
  const router = useRouter();
  const { coletor, setColetor, clearColetor } = useColetorSession();
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isSmallDesktop = useIsSmallDesktop();

  // Largura do sidebar ajustada para desktop pequeno
  const sidebarWidth = isSmallDesktop ? 200 : 240;

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
      key: '/coletores/coletas-realizadas',
      icon: <InboxOutlined />,
      label: 'Coletas realizadas',
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
          padding: isMobile ? '0 16px' : '0 24px',
          background: '#001529',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          height: 56,
        }}
      >
        {isMobile ? (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20, color: 'white' }} />}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          />
        ) : (
          <div style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
            Envio Legal • Coletor Autônomo
          </div>
        )}
        {isMobile && (
          <div style={{ color: 'white', fontSize: 15, fontWeight: 'bold' }}>
            Coletor
          </div>
        )}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }}>
            {!isMobile && coletor.pfNome}
          </Button>
        </Dropdown>
      </Header>

      {/* Mobile: Drawer menu */}
      {isMobile && (
        <Drawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          placement="left"
          closeIcon={null}
          styles={{
            header: { display: 'none' },
            body: { padding: 0, display: 'flex', flexDirection: 'column' },
            wrapper: { width: 280 },
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 56,
              padding: '0 16px',
              background: '#001529',
              color: 'white',
            }}
          >
            <span style={{ fontWeight: 'bold' }}>Coletor Autônomo</span>
            <Button
              type="text"
              icon={<CloseOutlined style={{ color: 'white' }} />}
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            />
          </div>
          {menuComponent}
        </Drawer>
      )}

      <Layout style={{ marginTop: 56 }}>
        {/* Desktop: Sidebar fixa */}
        {!isMobile && (
          <Sider
            width={sidebarWidth}
            style={{
              background: '#fff',
              position: 'fixed',
              left: 0,
              top: 56,
              bottom: 0,
              height: 'calc(100vh - 56px)',
              zIndex: 1000,
              overflow: 'auto',
              transition: 'width 0.2s ease',
            }}
          >
            {menuComponent}
          </Sider>
        )}
        <Layout style={{ marginLeft: isMobile ? 0 : sidebarWidth, transition: 'margin-left 0.2s' }}>
          <Content
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              height: 'calc(100vh - 56px)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? 16 : 24,
              }}
            >
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
