"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/stores/auth";
import { Spin } from "antd";

const LOGIN_PATH = "/auth/login";

type AuthLayoutClientProps = {
  children: ReactNode;
};

export default function AuthLayoutClient({ children }: AuthLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const storeHydrated = useAuthHydrated();

  useEffect(() => {
    // Wait for zustand to hydrate before checking auth
    if (!storeHydrated) return;

    if (isAuthenticated && pathname.startsWith(LOGIN_PATH)) {
      router.replace("/");
    }
  }, [storeHydrated, isAuthenticated, pathname, router]);

  // Show loading while hydrating
  if (!storeHydrated) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated && pathname.startsWith(LOGIN_PATH)) {
    return null;
  }

  return children;
}
