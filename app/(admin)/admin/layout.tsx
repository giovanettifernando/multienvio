"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layout, Menu, Typography, Flex, Spin } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { checkAdminAuth } from "@/lib/admin/auth";
import { useAdminSession } from "@/stores/useAdminSession";
import { spacing } from "@/lib/ui/theme";

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
  const [isChecking, setIsChecking] = useState(true);

  const currentNavItem = useMemo(() => {
    // Procurar no nível principal
    let found = ADMIN_NAV.find((item) => {
      if (item.href === "/admin") {
        return pathname === "/admin";
      }
      if (item.href) {
        return pathname.startsWith(item.href);
      }
      return false;
    });

    // Se não encontrou, procurar nos children
    if (!found) {
      for (const item of ADMIN_NAV) {
        if (item.children) {
          found = item.children.find((child) => {
            if (child.href === "/admin") {
              return pathname === "/admin";
            }
            if (child.href) {
              return pathname.startsWith(child.href);
            }
            return false;
          });
          if (found) break;
        }
      }
    }

    return found;
  }, [pathname]);

  // Check authentication on mount and when pathname changes
  useEffect(() => {
    if (pathname === "/admin/login") {
      setIsChecking(false);
      return;
    }

    const verifyAuth = async () => {
      setIsChecking(true);
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
  }, [pathname, router, setAdmin, clearAdmin]);

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
            })),
          };
        }

        // Item simples
        return {
          key: item.key,
          label: <Link href={item.href!}>{item.label}</Link>,
        };
      }),
    [authorizedNav],
  );

  // Encontrar a key selecionada (pode estar no nível principal ou nos children)
  const selectedKey = useMemo(() => {
    // Procurar no nível principal
    let found = authorizedNav.find((item) => {
      if (item.href === "/admin") {
        return pathname === "/admin";
      }
      if (item.href) {
        return pathname.startsWith(item.href);
      }
      return false;
    });

    if (found) return found.key;

    // Procurar nos children
    for (const item of authorizedNav) {
      if (item.children) {
        found = item.children.find((child) => {
          if (child.href === "/admin") {
            return pathname === "/admin";
          }
          if (child.href) {
            return pathname.startsWith(child.href);
          }
          return false;
        });
        if (found) return found.key;
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

  if (pathname === "/admin/login") {
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

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <Layout.Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={64}
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
          style={{ borderRight: 0 }}
        />
      </Layout.Sider>
      <Layout style={{ marginLeft: 240, transition: "margin-left 0.2s" }}>
        <Layout.Content
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: spacing.xl,
            }}
          >
            {children}
          </div>
        </Layout.Content>
      </Layout>
      <style jsx global>{`
        /* Responsive sidebar adjustments for admin */
        @media (max-width: 767px) {
          .ant-layout {
            margin-left: 0 !important;
          }
          .ant-layout-sider {
            position: relative !important;
          }
        }

        @media (min-width: 768px) {
          .ant-layout-sider {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            z-index: 1000 !important;
          }
        }
      `}</style>
    </Layout>
  );
}
