import type { Metadata } from "next";
import AccountTabs from "@/components/account/AccountTabs";

export const metadata: Metadata = {
  title: "Minha Conta",
};

export default function MinhaContaPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ marginBottom: 4, fontSize: 28, fontWeight: 600 }}>
          Minha Conta
        </h2>
        <p style={{ marginBottom: 0, color: "rgba(0,0,0,0.45)" }}>
          Gerencie seus dados pessoais, endereços, cartões e segurança.
        </p>
      </div>
      <AccountTabs />
    </div>
  );
}
