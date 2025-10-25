"use client";

import React, { useEffect, useState } from "react";
import { Tabs } from "antd";
import PersonalForm from "./PersonalForm";
import AddressesList from "./AddressesList";
import CardsList from "./CardsList";
import RecipientsList from "./RecipientsList";
import SecurityForm from "./SecurityForm";

type TabKey = "personal" | "addresses" | "cards" | "recipients" | "security";

export default function AccountTabs() {
  const [activeKey, setActiveKey] = useState<TabKey>("personal");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "") as TabKey;
    if (hash) {
      setActiveKey(hash);
    }
    const handler = () => {
      const current = window.location.hash.replace("#", "") as TabKey;
      if (current) {
        setActiveKey(current);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const handleChange = (key: string) => {
    const normalized = (key as TabKey) || "personal";
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
        { key: "personal", label: "Dados Pessoais", children: <PersonalForm /> },
        { key: "addresses", label: "Endereços", children: <AddressesList /> },
        { key: "cards", label: "Cartões", children: <CardsList /> },
        { key: "recipients", label: "Destinatários", children: <RecipientsList /> },
        { key: "security", label: "Segurança", children: <SecurityForm /> },
      ]}
    />
  );
}
