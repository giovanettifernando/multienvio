"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "antd";
import AddressesList from "./AddressesList";
import CardsList from "./CardsList";
import RecipientsList from "./RecipientsList";
import SecurityForm from "./SecurityForm";

type TabKey = "addresses" | "cards" | "recipients" | "security";

export default function AccountTabs() {
  const [activeKey, setActiveKey] = useState<TabKey>("addresses");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as string;

    // Ignorar hash "personal" (dados pessoais agora estão sempre visíveis)
    if (hash && hash !== "personal") {
      setActiveKey(hash as TabKey);
    }

    const handler = () => {
      const current = window.location.hash.replace("#", "") as string;

      // Se for #personal, remover o hash e não fazer nada (dados pessoais já visíveis)
      if (current === "personal") {
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      if (current && current !== "personal") {
        setActiveKey(current as TabKey);
      }
    };

    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const handleChange = (key: string) => {
    const normalized = (key as TabKey) || "addresses";
    setActiveKey(normalized);
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
        { key: "recipients", label: "Destinatários", children: <RecipientsList /> },
        { key: "security", label: "Segurança", children: <SecurityForm /> },
      ]}
    />
  );
}
