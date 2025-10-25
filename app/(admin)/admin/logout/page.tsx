"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clearAdminSessionStorage,
  clearAdminTokenCookie,
} from "@/lib/admin/auth";
import { useAdminSession } from "@/stores/useAdminSession";

export default function AdminLogoutPage() {
  const clearAdmin = useAdminSession((state) => state.clearAdmin);
  const router = useRouter();

  useEffect(() => {
    clearAdminTokenCookie();
    clearAdminSessionStorage();
    clearAdmin();
    router.replace("/admin/login");
  }, [clearAdmin, router]);

  return null;
}
