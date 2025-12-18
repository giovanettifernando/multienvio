import type { Page } from "@playwright/test";

type MockUser = {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
};

/**
 * Injeta um usuário autenticado diretamente na store persistida do Zustand.
 * Útil para testes sem depender do fluxo real de login.
 */
export async function loginAsDefaultUser(page: Page, overrides?: Partial<MockUser>): Promise<MockUser> {
  const now = new Date().toISOString();

  const user: MockUser = {
    id: "test-user-id",
    name: "Usuário Playwright",
    email: "playwright@example.com",
    status: "active",
    roles: [],
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    ...overrides,
  };

  const storageValue = JSON.stringify({
    state: {
      user,
      hasCompany: true,
    },
    version: 3,
  });

  await page.addInitScript(
    ({ value }) => {
      window.localStorage.setItem("envio-legal-auth", value);
    },
    { value: storageValue },
  );

  return user;
}
