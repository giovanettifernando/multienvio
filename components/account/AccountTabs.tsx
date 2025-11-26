"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import { Tabs } from "antd";
import AddressesList from "./AddressesList";
import CardsList from "./CardsList";
import RecipientsList from "./RecipientsList";
import RecurringItemsList from "./RecurringItemsList";
import SecurityForm from "./SecurityForm";

type TabKey = "addresses" | "cards" | "recipients" | "recurring-items" | "security";

// Hook para ler hash da URL de forma reativa
function useHash(): string {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("hashchange", callback);
      return () => window.removeEventListener("hashchange", callback);
    },
    () => (typeof window !== "undefined" ? window.location.hash.replace("#", "") : ""),
    () => ""
  );
}

function getInitialTab(hash: string): TabKey {
  if (hash && hash !== "personal") {
    return hash as TabKey;
  }
  return "addresses";
}

export default function AccountTabs() {
  const hash = useHash();
  // Derivar activeKey do hash
  const activeKey = getInitialTab(hash);

  // Limpar hash "personal" se presente
  useEffect(() => {
    if (hash === "personal") {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [hash]);

  const handleChange = (key: string) => {
    const normalized = (key as TabKey) || "addresses";
    if (typeof window !== "undefined") {
      window.location.hash = normalized;
    }
  };

  return (
    <Tabs
      activeKey={activeKey}
      onChange={handleChange}
      items={[
        { key: "addresses", label: "Endereços", children: <AddressesList /> },
        { key: "cards", label: "Cartões", children: <CardsList /> },
        { key: "recipients", label: "Destinatários recorrentes", children: <RecipientsList /> },
        { key: "recurring-items", label: "Itens recorrentes", children: <RecurringItemsList /> },
        { key: "security", label: "Segurança", children: <SecurityForm /> },
      ]}
    />
  );
}
