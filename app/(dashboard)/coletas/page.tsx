"use client";

import { useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { PageShell } from "@/components/shared/PageShell";
import { SearchFilters } from "@/components/shared/SearchFilters";
import { ColetasTable } from "@/components/coletas/ColetasTable";
import { ReagendarModal } from "@/components/coletas/ReagendarModal";
import { useColetas } from "@/lib/coletas/hooks";
import type { Coleta, ColetaFilters } from "@/lib/coletas/types";

const { RangePicker } = DatePicker;

export default function ColetasPage() {
  const [filters, setFilters] = useState<ColetaFilters>({
    q: "",
    status: "all",
    page: 1,
    pageSize: 10,
    sort: "scheduledFor_desc",
  });

  const [selectedColeta, setSelectedColeta] = useState<Coleta | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useColetas(filters);

  const handleSearch = (q: string) => {
    setFilters((prev) => ({ ...prev, q, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status as ColetaFilters["status"],
      page: 1,
    }));
  };

  const handleDateRangeChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!dates || !dates[0] || !dates[1]) {
      setFilters((prev) => ({
        ...prev,
        from: undefined,
        to: undefined,
        page: 1,
      }));
      return;
    }

    const [start, end] = dates;
    if (start && end) {
      setFilters((prev) => ({
        ...prev,
        from: start.format("YYYY-MM-DD"),
        to: end.format("YYYY-MM-DD"),
        page: 1,
      }));
    }
  };

  const handleReset = () => {
    setFilters({
      q: "",
      status: "all",
      page: 1,
      pageSize: 10,
      sort: "scheduledFor_desc",
    });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, pageSize }));
  };

  const handleReagendar = (coleta: Coleta) => {
    setSelectedColeta(coleta);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedColeta(null);
  };

  return (
    <PageShell
      title="Coletas Agendadas"
      description="Gerencie as coletas no endereço geradas após o checkout"
    >
      <SearchFilters
        searchValue={filters.q}
        onSearchChange={handleSearch}
        searchPlaceholder="Buscar por pedido ou CEP..."
        filters={[
          {
            value: filters.status || "all",
            onChange: handleStatusFilter,
            options: [
              { label: "Todos os Status", value: "all" },
              { label: "Agendada", value: "agendada" },
              { label: "Reagendada", value: "reagendada" },
              { label: "Concluída", value: "concluida" },
              { label: "Cancelada", value: "cancelada" },
            ],
            placeholder: "Status",
          },
        ]}
        onReset={handleReset}
        extra={
          <RangePicker
            format="DD/MM/YYYY"
            placeholder={["Data inicial", "Data final"]}
            onChange={handleDateRangeChange}
          />
        }
      />

      <ColetasTable
        data={data?.items || []}
        loading={isLoading}
        onReagendar={handleReagendar}
        pagination={{
          current: data?.page || 1,
          pageSize: data?.pageSize || 10,
          total: data?.total || 0,
          onChange: handlePageChange,
        }}
      />

      <ReagendarModal
        coleta={selectedColeta}
        open={modalOpen}
        onClose={handleCloseModal}
      />
    </PageShell>
  );
}
