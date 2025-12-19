"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ELSpace, ELTooltip, ELTabs, useBreakpoint } from '@/shared/ui';
const Space = ELSpace;
const Tooltip = ELTooltip;
import {
  EnvironmentOutlined,
  CreditCardOutlined,
  TeamOutlined,
  InboxOutlined,
  LockOutlined,
} from "@ant-design/icons";
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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
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

  // Labels curtos para mobile, completos para desktop
  const tabItems = [
    {
      key: "addresses",
      label: isMobile ? (
        <Tooltip title="Endereços"><EnvironmentOutlined /></Tooltip>
      ) : (
        <Space><EnvironmentOutlined />Endereços</Space>
      ),
      children: <AddressesList />,
    },
    {
      key: "cards",
      label: isMobile ? (
        <Tooltip title="Cartões"><CreditCardOutlined /></Tooltip>
      ) : (
        <Space><CreditCardOutlined />Cartões</Space>
      ),
      children: <CardsList />,
    },
    {
      key: "recipients",
      label: isMobile ? (
        <Tooltip title="Destinatários"><TeamOutlined /></Tooltip>
      ) : (
        <Space><TeamOutlined />Destinatários</Space>
      ),
      children: <RecipientsList />,
    },
    {
      key: "recurring-items",
      label: isMobile ? (
        <Tooltip title="Itens recorrentes"><InboxOutlined /></Tooltip>
      ) : (
        <Space><InboxOutlined />Itens recorrentes</Space>
      ),
      children: <RecurringItemsList />,
    },
    {
      key: "security",
      label: isMobile ? (
        <Tooltip title="Segurança"><LockOutlined /></Tooltip>
      ) : (
        <Space><LockOutlined />Segurança</Space>
      ),
      children: <SecurityForm />,
    },
  ];

  return (
    <ELTabs
      activeKey={activeKey}
      onChange={handleChange}
      items={tabItems}
      size={isMobile ? "small" : "middle"}
    />
  );
}
