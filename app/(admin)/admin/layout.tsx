"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Layout, Menu, Typography, Flex } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin/nav";
import {
  devAdminBypassActive,
  getAdminTokenFromCookie,
  loadAdminSessionFromStorage,
} from "@/lib/admin/auth";
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
  const token = useAdminSession((state) => state.token);
  const setAdmin = useAdminSession((state) => state.setAdmin);

  const currentNavItem = useMemo(() => {
    return ADMIN_NAV.find((item) => {
      if (item.href === "/admin") {
        return pathname === "/admin";
      }
      return pathname.startsWith(item.href);
    });
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/login") return;
    if (devAdminBypassActive()) return;

    const cookieToken = getAdminTokenFromCookie();

    if (cookieToken && token !== cookieToken) {
      const stored = loadAdminSessionFromStorage();
      if (stored && stored.token === cookieToken) {
        setAdmin(stored.admin, stored.token);
        return;
      }
    }

    if (!cookieToken || !token) {
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, setAdmin, token]);

  const hasPermission = useAdminSession((state) => state.hasPermission);
  const isSuperAdmin = useAdminSession((state) => state.isSuperAdmin);

  useEffect(() => {
    if (!currentNavItem?.permissions) return;
    if (!admin) return;

    // Super admin has access to everything
    if (isSuperAdmin()) return;

    // Check if user has any of the required permissions
    const hasAccess = currentNavItem.permissions.some((perm) =>
      hasPermission(perm)
    );

    if (!hasAccess) {
      router.replace("/admin");
    }
  }, [admin, currentNavItem, router, hasPermission, isSuperAdmin]);

  const authorizedNav = useMemo(() => {
    return ADMIN_NAV.filter((item) => {
      if (!item.permissions) return true;
      if (!admin) return false;

      // Super admin has access to everything
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

  return (
    <Layout style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <Layout.Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={64}
        style={{
          background: "#FFFFFF",
          borderRight: "1px solid var(--color-border)",
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
      <Layout>
        <Layout.Content style={{ padding: spacing.xl }}>
          {children}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
