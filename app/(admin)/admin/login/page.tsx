"use client";

import { Suspense, useState, useEffect } from "react";
import { App, Button, Card, Form, Input } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminSession } from "@/stores/useAdminSession";
import {
  ADMIN_PERMISSION_KEYS,
  type AdminPermissionKey,
  type AdminStatus,
} from "@/lib/auth/types";

type LoginFormValues = {
  email: string;
  password: string;
};

function AdminLoginForm() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/admin";
  const setAdmin = useAdminSession((state) => state.setAdmin);
  const [loading, setLoading] = useState(false);

  // Show message if redirected due to inactivity
  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason === 'inactivity') {
      message.warning('Sua sessão expirou por inatividade. Por favor, faça login novamente.');
    }
  }, [searchParams, message]);

  async function onFinish(values: LoginFormValues) {
    setLoading(true);

    try {
      // Call the real admin login API
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.message || "E-mail ou senha incorretos");
        setLoading(false);
        return;
      }

      // Update store with staff data
      const rawPermissions = Array.isArray(data.staff.permissions)
        ? data.staff.permissions
        : [];
      const permissionSet = new Set<AdminPermissionKey>(ADMIN_PERMISSION_KEYS);
      const permissions: AdminPermissionKey[] = data.staff.isSuperAdmin
        ? [...ADMIN_PERMISSION_KEYS]
        : rawPermissions.filter((perm: unknown): perm is AdminPermissionKey =>
            typeof perm === "string" && permissionSet.has(perm as AdminPermissionKey),
          );

      const status: AdminStatus = data.staff.status === "BLOCKED" ? "blocked" : "active";

      const admin = {
        id: data.staff.id,
        email: data.staff.email,
        name: data.staff.name,
        status,
        isSuperAdmin: Boolean(data.staff.isSuperAdmin),
        permissions,
        role: data.staff.role,
      };

      setAdmin(admin);
      message.success(`Bem-vindo, ${data.staff.name}`);
      router.replace(next);
    } catch (error) {
      console.error("Login error:", error);
      message.error("Erro ao fazer login");
      setLoading(false);
    }
  }

  return (
    <Card title="Admin • Login" style={{ width: 360 }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: "E-mail é obrigatório" },
            { type: "email", message: "E-mail inválido" },
          ]}
        >
          <Input placeholder="usuario@enviolegal.com" />
        </Form.Item>
        <Form.Item
          label="Senha"
          name="password"
          rules={[{ required: true, message: "Senha é obrigatória" }]}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Entrar
        </Button>
      </Form>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Suspense
        fallback={
          <Card title="Admin • Login" style={{ width: 360 }}>
            Carregando...
          </Card>
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
