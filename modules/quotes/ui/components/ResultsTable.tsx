"use client";

import {
  ArrowDownOutlined,
  FieldTimeOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  ELAvatar,
  ELFlexAntd,
  ELSegmented,
  ELTag,
  ELTypography,
} from '@/shared/ui';
const Avatar = ELAvatar;
const Flex = ELFlexAntd;
const Segmented = ELSegmented;
const Tag = ELTag;
const Typography = ELTypography;
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { useMemo, useState } from "react";
import type { QuoteResultItem } from '@/shared/types/quote';
import { useCarrierIcons } from "@/shared/hooks";

type SortOrder = "price" | "prazo";

type ResultsTableProps = {
  results: QuoteResultItem[];
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  onSelect: (result: QuoteResultItem) => void;
  loading?: boolean;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const sortResults = (results: QuoteResultItem[], order: SortOrder) => {
  const items = [...results];
  if (order === "price") {
    items.sort((a, b) => a.preco - b.preco);
  } else {
    items.sort((a, b) => a.prazoDias - b.prazoDias);
  }
  return items;
};

const buildAvatarLabel = (carrier: string) => {
  const initials = carrier
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "T";
};

/**
 * Deriva o slug da transportadora a partir do nome.
 * Ex: "Correios" -> "correios", "JadLog" -> "jadlog"
 */
const deriveCarrierSlug = (carrierName: string): string => {
  return carrierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]+/g, "-") // Substitui caracteres especiais por hífen
    .replace(/^-|-$/g, ""); // Remove hífens no início/fim
};

export function ResultsTable({
  results,
  sortOrder,
  onSortChange,
  onSelect,
  loading,
}: ResultsTableProps) {
  const sorted = useMemo(
    () => sortResults(results, sortOrder),
    [results, sortOrder],
  );

  const { carrierIcons } = useCarrierIcons();
  const [iconErrors, setIconErrors] = useState<Record<string, boolean>>({});

  const handleIconError = (slug: string) => {
    setIconErrors((prev) => ({ ...prev, [slug]: true }));
  };

  const columns: DataTableColumn<QuoteResultItem>[] = [
    {
      title: "Transportadora",
      dataIndex: "carrier",
      key: "carrier",
      showInCard: true,
      cardLabel: "Transportadora",
      render: (value: unknown) => {
        const carrier = value as string;
        const slug = deriveCarrierSlug(carrier);
        const iconUrl = carrierIcons[slug];
        const hasError = iconErrors[slug];
        const showIcon = iconUrl && !hasError;

        return (
          <Flex align="center" gap={12}>
            {showIcon ? (
              <Avatar
                shape="square"
                src={iconUrl}
                style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                onError={() => {
                  handleIconError(slug);
                  return false;
                }}
              >
                {buildAvatarLabel(carrier)}
              </Avatar>
            ) : (
              <Avatar
                shape="square"
                style={{ backgroundColor: "#1d39c4", color: "#fff" }}
              >
                {buildAvatarLabel(carrier)}
              </Avatar>
            )}
            <div>
              <Typography.Text strong>{carrier}</Typography.Text>
            </div>
          </Flex>
        );
      },
    },
    {
      title: "Modalidade",
      dataIndex: "modalidade",
      key: "modalidade",
      showInCard: true,
      cardLabel: "Serviço",
      render: (value: unknown) => (
        <Typography.Text>{value as string}</Typography.Text>
      ),
    },
    {
      title: "Prazo estimado",
      dataIndex: "prazoDias",
      key: "prazoDias",
      showInCard: true,
      cardLabel: "Prazo",
      render: (value: unknown) => {
        const dias = value as number;
        return (
          <Flex align="center" gap={6}>
            <FieldTimeOutlined />
            <Typography.Text>
              {dias === 1 ? "1 dia útil" : `${dias} dias úteis`}
            </Typography.Text>
          </Flex>
        );
      },
    },
    {
      title: "Preço",
      dataIndex: "preco",
      key: "preco",
      showInCard: true,
      cardLabel: "Valor",
      render: (value: unknown) => (
        <Flex align="center" gap={6}>
          <ArrowDownOutlined style={{ color: "#389e0d" }} />
          <Typography.Text strong>{currency.format(value as number)}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Seguro",
      dataIndex: "exigeSeguro",
      key: "exigeSeguro",
      showInCard: true,
      cardLabel: "Seguro",
      render: (value: unknown) =>
        value ? (
          <Tag icon={<SafetyCertificateOutlined />} color="volcano">
            Obrigatório
          </Tag>
        ) : (
          <Tag color="blue">Opcional</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      isActions: true,
      showInCard: true,
      render: (_value: unknown, record: QuoteResultItem) => (
        <ELButton
          variant="primary"
          icon={<LogoutOutlined />}
          onClick={() => onSelect(record)}
        >
          Selecionar
        </ELButton>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <ELCard
        header={{
          title: "Resultados",
          extra: (
            <Flex align="center" gap={8}>
              <Typography.Text type="secondary">Ordenar por</Typography.Text>
              <Segmented<SortOrder>
                value={sortOrder}
                onChange={(value) => onSortChange(value as SortOrder)}
                options={[
                  { label: "Mais barato", value: "price" },
                  { label: "Menor prazo", value: "prazo" },
                ]}
              />
            </Flex>
          ),
        }}
      >
        <DataTable
          data={sorted}
          columns={columns}
          rowKey="id"
          loading={loading}
          enableMobileCards={true}
          pagination={false}
          emptyMessage="Nenhuma cotação encontrada"
          emptyDescription="Não encontramos opções de frete com os filtros atuais."
        />
      </ELCard>
    </Flex>
  );
}
