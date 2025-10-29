"use client";

import { useEffect, useState } from "react";
import { App } from "antd";
import { PageShell } from "@/components/shared/PageShell";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { ColetasTable } from "@/components/coletas/ColetasTable";
import { useColetas } from "@/hooks/useColetas";
import { useColetasStore } from "@/stores/coletas";
import {
  CollectionStatus,
  COLLECTION_STATUS_LABELS,
} from "@/types/contracts";
import type { Coleta, ColetaStatus } from "@/lib/coletas/types";
import { subscribeCheckoutEvents } from "@/lib/checkout/orchestrator";

export default function ColetasPage() {
  const { message } = App.useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ColetaStatus | "all">("all");
  const subscribeExternal = useColetasStore((s) => s.subscribeExternal);

  // Subscribe to external changes (other tabs/checkout)
  useEffect(() => {
    const unsubscribe = subscribeExternal();
    return () => unsubscribe();
  }, [subscribeExternal]);

  // Subscribe to checkout events
  useEffect(() => {
    const unsubscribe = subscribeCheckoutEvents((event, data) => {
      if (event === "collection_created") {
        message.success(
          `Nova coleta criada para envio ${data.shipmentId}`,
          3
        );
      }
    });

    return () => unsubscribe();
  }, [message]);

  const coletasResult = useColetas({
    q: searchQuery,
    status: statusFilter,
    pageSize: 20, // 20 items per page
  });

  const coletas = coletasResult.items;

  const handleSearch = (q: string) => {
    setSearchQuery(q);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status as ColetaStatus | "all");
  };

  const handleReset = () => {
    setSearchQuery("");
    setStatusFilter("all");
  };

  return (
    <PageShell
      title="Coletas"
      description="Gerencie as coletas criadas automaticamente após o checkout"
    >
      <SearchFilters
        searchValue={searchQuery}
        onSearchChange={handleSearch}
        searchPlaceholder="Buscar por ID do envio, cidade ou UF..."
        filters={[
          {
            value: statusFilter || "all",
            onChange: handleStatusFilter,
            options: [
              { label: "Todos os Status", value: "all" },
              {
                label: COLLECTION_STATUS_LABELS[CollectionStatus.ABERTA],
                value: CollectionStatus.ABERTA,
              },
              {
                label: COLLECTION_STATUS_LABELS[CollectionStatus.AGENDADA],
                value: CollectionStatus.AGENDADA,
              },
              {
                label: COLLECTION_STATUS_LABELS[CollectionStatus.EM_ANDAMENTO],
                value: CollectionStatus.EM_ANDAMENTO,
              },
              {
                label: COLLECTION_STATUS_LABELS[CollectionStatus.CONCLUIDA],
                value: CollectionStatus.CONCLUIDA,
              },
              {
                label: COLLECTION_STATUS_LABELS[CollectionStatus.CANCELADA],
                value: CollectionStatus.CANCELADA,
              },
            ],
            placeholder: "Status",
          },
        ]}
        onReset={handleReset}
      />

      <ColetasTable data={coletas} loading={false} />
    </PageShell>
  );
}
