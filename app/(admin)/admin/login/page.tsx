"use client";

import { Suspense } from "react";
import { App, Button, Card, Form, Input, Select } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveAdminSessionToStorage,
  setAdminTokenCookie,
} from "@/lib/admin/auth";
import { useAdminSession, type AdminRole } from "@/stores/useAdminSession";

type LoginFormValues = {
  email: string;
  password: string;
  role: AdminRole;
};

function AdminLoginForm() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/admin";
  const setAdmin = useAdminSession((state) => state.setAdmin);

  async function onFinish(values: LoginFormValues) {
    const token = "mock-admin-token";
    const admin = { id: "1", email: values.email, role: values.role };
    setAdminTokenCookie(token);
    saveAdminSessionToStorage(admin, token);
    setAdmin(admin, token);
    message.success("Bem-vindo ao Admin");
    router.replace(next);
  }

  return (
    <Card title="Admin • Login" style={{ width: 360 }}>
      <Form
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ role: "superadmin" }}
      >
        <Form.Item
          label="E-mail"
          name="email"
          rules={[{ required: true, type: "email" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Senha" name="password" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item
          label="Perfil de acesso"
          name="role"
          rules={[{ required: true }]}
        >
          <Select
            options={[
              { label: "Super Admin", value: "superadmin" },
              { label: "Operações", value: "ops" },
              { label: "Financeiro", value: "finance" },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
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
