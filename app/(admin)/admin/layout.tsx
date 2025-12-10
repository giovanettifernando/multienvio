"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import { Layout, Menu, Typography, Flex, Spin, Button, Drawer } from "antd";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { checkAdminAuth } from "@/lib/admin/auth";
import { useAdminSession } from "@/stores/useAdminSession";
import { SessionIdleModal } from "@/components/session/SessionIdleModal";
import { spacing } from "@/lib/ui/theme";

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdminSession((state) => state.admin);
  const setAdmin = useAdminSession((state) => state.setAdmin);
  const clearAdmin = useAdminSession((state) => state.clearAdmin);
  const hasVerified = useRef(false);
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Logout handler para o SessionIdleModal
  const handleAdminLogout = useCallback(async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignorar erros
    }
    clearAdmin();
  }, [clearAdmin]);

  // isChecking starts false for login page (computed from pathname)
  const [isChecking, setIsChecking] = useState(() => pathname !== "/admin/login");

  const currentNavItem = useMemo(() => {
    // Coletar todos os itens com href (principal e children)
    type NavItemWithHref = typeof ADMIN_NAV[number] & { href: string };
    const allItems: NavItemWithHref[] = [];

    for (const item of ADMIN_NAV) {
      if (item.href) {
        allItems.push(item as NavItemWithHref);
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.href) {
            allItems.push(child as NavItemWithHref);
          }
        }
      }
    }

    // Ordenar por tamanho do href (mais específico primeiro)
    allItems.sort((a, b) => b.href.length - a.href.length);

    // Encontrar o primeiro match
    for (const item of allItems) {
      if (item.href === "/admin") {
        if (pathname === "/admin") return item;
      } else if (pathname.startsWith(item.href)) {
        return item;
      }
    }

    return undefined;
  }, [pathname]);

  // Initial state based on pathname (computed synchronously)
  const isLoginPage = pathname === "/admin/login";

  // Check authentication on mount and when pathname changes
  useEffect(() => {
    if (isLoginPage) return;

    // Se já verificou nesta sessão, não verificar novamente
    if (hasVerified.current) {
      // Se já verificou e tem admin no store, apenas marca como não-checking
      if (admin) {
        setIsChecking(false);
      }
      // Se já verificou e não tem admin, o redirect já foi disparado
      return;
    }

    const verifyAuth = async () => {
      hasVerified.current = true;
      const staffUser = await checkAdminAuth();

      if (!staffUser) {
        clearAdmin();
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setAdmin(staffUser);
      }

      setIsChecking(false);
    };

    verifyAuth();
  }, [pathname, router, setAdmin, clearAdmin, isLoginPage, admin]);

  const hasPermission = useAdminSession((state) => state.hasPermission);
  const isSuperAdmin = useAdminSession((state) => state.isSuperAdmin);

  // Check permissions for current route
  useEffect(() => {
    if (!currentNavItem?.permissions) return;
    if (!admin) return;

    // Admin role has access to everything
    if (isSuperAdmin()) return;

    // Check if user has any of the required permissions
    const hasAccess = currentNavItem.permissions.some((perm) =>
      hasPermission(perm)
    );

    if (!hasAccess) {
      router.replace("/admin");
    }
  }, [admin, currentNavItem, router, hasPermission, isSuperAdmin]);

  // Filter nav items based on permissions
  const authorizedNav = useMemo(() => {
    return ADMIN_NAV.map((item) => {
      // Se tem children, filtrar os children baseado em permissões
      if (item.children) {
        const authorizedChildren = item.children.filter((child) => {
          if (!child.permissions) return true;
          if (!admin) return false;
          if (isSuperAdmin()) return true;
          return child.permissions.some((perm) => hasPermission(perm));
        });

        // Se não tem children autorizados, não mostrar o grupo
        if (authorizedChildren.length === 0) return null;

        return { ...item, children: authorizedChildren };
      }

      // Verificar permissões do item principal
      if (!item.permissions) return item;
      if (!admin) return null;
      if (isSuperAdmin()) return item;
      return item.permissions.some((perm) => hasPermission(perm)) ? item : null;
    }).filter((item) => item !== null);
  }, [admin, hasPermission, isSuperAdmin]);

  const menuItems = useMemo(
    () =>
      authorizedNav.map((item) => {
        // Se tem children, criar submenu
        if (item.children) {
          return {
            key: item.key,
            label: item.label,
            children: item.children.map((child) => ({
              key: child.key,
              label: <Link href={child.href!}>{child.label}</Link>,
              onClick: () => setMobileMenuOpen(false),
            })),
          };
        }

        // Item simples
        return {
          key: item.key,
          label: <Link href={item.href!}>{item.label}</Link>,
          onClick: () => setMobileMenuOpen(false),
        };
      }),
    [authorizedNav],
  );

  // Encontrar a key selecionada (pode estar no nível principal ou nos children)
  const selectedKey = useMemo(() => {
    // Coletar todos os itens com href (principal e children)
    const allItems: Array<{ key: string; href: string }> = [];

    for (const item of authorizedNav) {
      if (item.href) {
        allItems.push({ key: item.key, href: item.href });
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.href) {
            allItems.push({ key: child.key, href: child.href });
          }
        }
      }
    }

    // Ordenar por tamanho do href (mais específico primeiro)
    allItems.sort((a, b) => b.href.length - a.href.length);

    // Encontrar o primeiro match
    for (const item of allItems) {
      if (item.href === "/admin") {
        if (pathname === "/admin") return item.key;
      } else if (pathname.startsWith(item.href)) {
        return item.key;
      }
    }

    return pathname === "/admin" ? "dashboard" : undefined;
  }, [authorizedNav, pathname]);

  // Manter o submenu aberto se algum de seus itens estiver ativo
  const defaultOpenKeys = useMemo(() => {
    const openKeys: string[] = [];

    for (const item of authorizedNav) {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => {
          if (child.href === "/admin") {
            return pathname === "/admin";
          }
          if (child.href) {
            return pathname.startsWith(child.href);
          }
          return false;
        });

        if (hasActiveChild) {
          openKeys.push(item.key);
        }
      }
    }

    return openKeys;
  }, [authorizedNav, pathname]);

  // Fechar menu mobile ao navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return children;
  }

  // Show loading while checking authentication
  if (isChecking) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh"
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // Sidebar content component (reutilizado no desktop e drawer mobile)
  const sidebarContent = (
    <>
      <Flex
        align="center"
        justify="center"
        style={{
          height: 56,
          padding: `0 ${spacing.lg}px`,
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Typography.Text
          strong
          style={{
            color: "var(--color-primary)",
            fontSize: 15,
          }}
        >
          Envio Legal · Admin
        </Typography.Text>
      </Flex>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        defaultOpenKeys={defaultOpenKeys}
        items={menuItems}
        style={{ borderRight: 0, flex: 1 }}
      />
    </>
  );

  return (
    <>
    <Layout style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      {/* Desktop: Sidebar fixa */}
      {!isMobile && (
        <Layout.Sider
          width={240}
          style={{
            background: "#FFFFFF",
            borderRight: "1px solid var(--color-border)",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            height: "100vh",
            zIndex: 1000,
            overflow: "auto",
          }}
        >
          {sidebarContent}
        </Layout.Sider>
      )}

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
          <Flex
            align="center"
            justify="space-between"
            style={{
              height: 56,
              padding: `0 16px`,
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <Typography.Text
              strong
              style={{
                color: "var(--color-primary)",
                fontSize: 15,
              }}
            >
              Envio Legal · Admin
            </Typography.Text>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            />
          </Flex>
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            defaultOpenKeys={defaultOpenKeys}
            items={menuItems}
            style={{ borderRight: 0, flex: 1 }}
          />
        </Drawer>
      )}

      <Layout style={{ marginLeft: isMobile ? 0 : 240, transition: "margin-left 0.2s" }}>
        {/* Mobile Header */}
        {isMobile && (
          <Header
            style={{
              background: "#FFFFFF",
              borderBottom: "1px solid var(--color-border)",
              padding: "0 16px",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              zIndex: 100,
            }}
          >
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20 }} />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              style={{ width: 44, height: 44 }}
            />
            <Typography.Text
              strong
              style={{
                color: "var(--color-primary)",
                fontSize: 15,
              }}
            >
              Admin
            </Typography.Text>
            <div style={{ width: 44 }} />
          </Header>
        )}
        <Content
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: isMobile ? "calc(100vh - 56px)" : "100vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? spacing.md : spacing.xl,
            }}
          >
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
    <SessionIdleModal
      isAuthenticated={!!admin}
      onLogout={handleAdminLogout}
      loginPath="/admin/login"
      returnParam="next"
      refreshEndpoint="/api/admin/auth/me"
    />
    </>
  );
}
