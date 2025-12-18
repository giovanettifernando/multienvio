"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { logoutAdmin } from "@/modules/admin/application/auth";
import { useAdminSession } from '@/modules/admin/ui/state/useAdminSession';
import { Spin } from "antd";

export default function LogoutClient() {
  const clearAdmin = useAdminSession((state) => state.clearAdmin);
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      // Call logout API to clear the HttpOnly cookie
      await logoutAdmin();

      // Clear local store
      clearAdmin();

      // Redirect to login
      router.replace("/admin/login");
    };

    performLogout();
  }, [clearAdmin, router]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh"
    }}>
      <Spin size="large" tip="Saindo...">
        <div style={{ minHeight: 100 }} />
      </Spin>
    </div>
  );
}
