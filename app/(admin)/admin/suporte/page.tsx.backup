"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Grid, Skeleton, Space, Typography } from "antd";
import { useAdminSession } from "@/stores/useAdminSession";
import { TicketsGrid } from "@/components/admin/support/TicketsGrid";
import { TicketSlideOver } from "@/components/admin/support/TicketSlideOver";
import type { TicketFiltersValue } from "@/components/admin/support/TicketFilters";
import { ticketCategoryValues, ticketStatusValues } from "@/lib/support/schemas";
import type { TicketCategory, TicketStatus } from "@/lib/support/types";

const DEFAULT_PAGE_SIZE = 10;

function parseNumberParam(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function resolveStatus(value: string | null): TicketFiltersValue["status"] {
  if (
    value &&
    ticketStatusValues.includes(value as TicketStatus)
  ) {
    return value as TicketFiltersValue["status"];
  }
  return "all";
}

function resolveCategory(value: string | null): TicketFiltersValue["category"] {
  if (
    value &&
    ticketCategoryValues.includes(value as TicketCategory)
  ) {
    return value as TicketFiltersValue["category"];
  }
  return "all";
}

function normalizeAssignee(value: string | null): TicketFiltersValue["assignee"] {
  if (value === "me" || value === "unassigned") return value;
  return "all";
}

export default function AdminSupportPage() {
  return (
    <Suspense fallback={<SupportPageSkeleton />}>
      <AdminSupportPageContent />
    </Suspense>
  );
}

function AdminSupportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const admin = useAdminSession((state) => state.admin);
  const viewerId = admin?.id;
  const screens = Grid.useBreakpoint();
  const isDesktop = (screens.lg ?? false) || false;

  const filters = useMemo<TicketFiltersValue>(() => {
    const params = searchParams;
    return {
      q: params.get("q") ?? "",
      status: resolveStatus(params.get("status")),
      category: resolveCategory(params.get("category")),
      assignee: normalizeAssignee(params.get("assignee")),
    };
  }, [searchParams]);

  const pagination = useMemo(
    () => ({
      page: parseNumberParam(searchParams.get("page"), 1),
      pageSize: parseNumberParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    }),
    [searchParams],
  );

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (!isDesktop) {
      setSelectedTicketId(null);
    }
  }, [isDesktop]);

  const updateSearchParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    const query = params.toString();
    router.replace(`/admin/suporte${query ? `?${query}` : ""}`);
  };

  const handleFiltersChange = (next: TicketFiltersValue) => {
    updateSearchParams((params) => {
      if (next.q) {
        params.set("q", next.q.trim());
      } else {
        params.delete("q");
      }

      if (next.status && next.status !== "all") {
        params.set("status", next.status);
      } else {
        params.delete("status");
      }

      if (next.category && next.category !== "all") {
        params.set("category", next.category);
      } else {
        params.delete("category");
      }

      const assignee = next.assignee ?? "all";
      if (assignee !== "all") {
        params.set("assignee", assignee);
      } else {
        params.delete("assignee");
      }

      params.delete("page");
    });
  };

  const handlePaginationChange = (page: number, pageSize: number) => {
    updateSearchParams((params) => {
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }

      if (pageSize === DEFAULT_PAGE_SIZE) {
        params.delete("pageSize");
      } else {
        params.set("pageSize", String(pageSize));
      }
    });
  };

  const handleSelectTicket = (ticketId: string) => {
    const query = searchParams.toString();
    if (isDesktop) {
      setSelectedTicketId(ticketId);
      return;
    }
    router.push(`/admin/suporte/${ticketId}${query ? `?${query}` : ""}`);
  };

  const handleCloseDrawer = () => {
    setSelectedTicketId(null);
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Suporte
        </Typography.Title>
        <Typography.Text type="secondary">
          Acompanhe os chamados abertos pelos clientes e responda rapidamente.
        </Typography.Text>
      </Space>

      <TicketsGrid
        filters={filters}
        pagination={pagination}
        viewerId={viewerId}
        onFiltersChange={handleFiltersChange}
        onPaginationChange={handlePaginationChange}
        onTicketSelect={handleSelectTicket}
      />

      <TicketSlideOver
        open={isDesktop && !!selectedTicketId}
        ticketId={selectedTicketId}
        viewerId={viewerId}
        onClose={handleCloseDrawer}
      />
    </Space>
  );
}

function SupportPageSkeleton() {
  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Skeleton active title paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 6 }} />
    </Space>
  );
}
