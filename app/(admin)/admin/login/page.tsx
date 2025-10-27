"use client";

import { Suspense, useState } from "react";
import { App, Button, Card, Form, Input } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveAdminSessionToStorage,
  setAdminTokenCookie,
} from "@/lib/admin/auth";
import { useAdminSession } from "@/stores/useAdminSession";
import { mockUsersDb } from "@/lib/auth/mock-db";

type LoginFormValues = {
  email: string;
  password: string;
};

const MASTER_CREDENTIALS = {
  email: "master@enviolegal.com",
  password: "master@@123",
};

function AdminLoginForm() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get("next") || "/admin";
  const setAdmin = useAdminSession((state) => state.setAdmin);
  const [loading, setLoading] = useState(false);

  async function onFinish(values: LoginFormValues) {
    setLoading(true);

    try {
      // Check master credentials
      if (
        values.email.toLowerCase() === MASTER_CREDENTIALS.email &&
        values.password === MASTER_CREDENTIALS.password
      ) {
        const masterUser = mockUsersDb.findByEmail(MASTER_CREDENTIALS.email);

        if (masterUser) {
          // Update last login
          mockUsersDb.updateLastLogin(masterUser.id);

          const token = "mock-admin-token-master";
          const admin = {
            id: masterUser.id,
            email: masterUser.email,
            name: masterUser.name,
            roles: masterUser.roles,
          };

          setAdminTokenCookie(token);
          saveAdminSessionToStorage(admin, token);
          setAdmin(admin, token);
          message.success(`Bem-vindo, ${masterUser.name}`);
          router.replace(next);
          return;
        }
      }

      // Check other users from mock database
      const user = mockUsersDb.findByEmail(values.email);

      if (!user) {
        message.error("E-mail ou senha incorretos");
        setLoading(false);
        return;
      }

      if (user.status === "blocked") {
        message.error("Usuário bloqueado. Entre em contato com o administrador.");
        setLoading(false);
        return;
      }

      // In a real app, we would validate password here
      // For mock, we just accept any password for non-master users
      mockUsersDb.updateLastLogin(user.id);

      const token = `mock-admin-token-${user.id}`;
      const admin = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      };

      setAdminTokenCookie(token);
      saveAdminSessionToStorage(admin, token);
      setAdmin(admin, token);
      message.success(`Bem-vindo, ${user.name}`);
      router.replace(next);
    } catch {
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
