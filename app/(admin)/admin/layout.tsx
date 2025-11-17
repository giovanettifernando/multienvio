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
    return ADMIN_NAV.find((item) => {
      if (item.href === "/admin") {
        return pathname === "/admin";
      }
      return pathname.startsWith(item.href);
    });
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
    return ADMIN_NAV.filter((item) => {
      if (!item.permissions) return true;
      if (!admin) return false;

      // Admin role has access to everything
      if (isSuperAdmin()) return true;

      // Check if user has any of the required permissions
      return item.permissions.some((perm) => hasPermission(perm));
    });
  }, [admin, hasPermission, isSuperAdmin]);

  const menuItems = useMemo(
    () =>
      authorizedNav.map((item) => ({
        key: item.key,
        label: <Link href={item.href}>{item.label}</Link>,
      })),
    [authorizedNav],
  );

  const selectedKey =
    authorizedNav.find((item) => {
      if (item.href === "/admin") {
        return pathname === "/admin";
      }
      return pathname.startsWith(item.href);
    })?.key ?? (pathname === "/admin" ? "dashboard" : undefined);

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
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Layout.Sider>
      <Layout style={{ marginLeft: 240, transition: "margin-left 0.2s" }}>
        <Layout.Content style={{ padding: spacing.xl, overflow: "auto" }}>
          {children}
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
