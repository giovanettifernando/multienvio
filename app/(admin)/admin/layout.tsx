"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Layout, Menu } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_NAV } from "@/lib/admin/nav";
import {
  devAdminBypassActive,
  getAdminTokenFromCookie,
  loadAdminSessionFromStorage,
} from "@/lib/admin/auth";
import { useAdminSession } from "@/stores/useAdminSession";

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

  useEffect(() => {
    if (!currentNavItem?.roles) return;
    if (!admin) return;
    if (!currentNavItem.roles.includes(admin.role)) {
      router.replace("/admin");
    }
  }, [admin, currentNavItem, router]);

  const authorizedNav = useMemo(() => {
    return ADMIN_NAV.filter((item) => {
      if (!item.roles) return true;
      return admin ? item.roles.includes(admin.role) : false;
    });
  }, [admin]);

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
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider width={240} breakpoint="lg" collapsedWidth={64}>
        <div style={{ color: "#fff", padding: 16, fontWeight: 600 }}>
          Envio Legal · Admin
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={menuItems}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Content style={{ padding: 24 }}>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
