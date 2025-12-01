"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

const LOGIN_PATH = "/auth/login";

type AuthLayoutClientProps = {
  children: ReactNode;
};

export default function AuthLayoutClient({ children }: AuthLayoutClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());

  useEffect(() => {
    if (isAuthenticated && pathname.startsWith(LOGIN_PATH)) {
      router.replace("/");
    }
  }, [isAuthenticated, pathname, router]);

  if (isAuthenticated && pathname.startsWith(LOGIN_PATH)) {
    return null;
  }

  return children;
}
