"use client";

import {
  CalendarOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { ELButton } from "@/components/ui/ELButton";
import { ELCard } from "@/components/ui/ELCard";
import { ELFlex } from "@/components/ui/ELGrid";

const ACTIONS: Array<{
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}> = [
  {
    label: "Nova etiqueta",
    description: "Gerar etiqueta individual",
    href: "/etiquetas",
    icon: <FileAddOutlined />,
  },
  {
    label: "Importar pedidos",
    description: "Planilha ou integração",
    href: "/pedidos/importar",
    icon: <CloudUploadOutlined />,
  },
  {
    label: "Rastrear pedido",
    description: "Consultar status",
    href: "/rastreamento",
    icon: <SearchOutlined />,
  },
  {
    label: "Solicitar coleta",
    description: "Agendar retirada",
    href: "/coletas/nova",
    icon: <CalendarOutlined />,
  },
  {
    label: "Simular em massa",
    description: "Cotações por arquivo",
    href: "/cotar/em-massa",
    icon: <ExperimentOutlined />,
  },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <ELCard
      header={{ title: "Ações rápidas" }}
      variant="borderless"
    >
      <ELFlex gap="md" wrap>
        {ACTIONS.map((action) => (
          <Tooltip key={action.label} title={action.description} placement="bottom">
            <ELButton
              variant="default"
              size="large"
              icon={action.icon}
              onClick={() => router.push(action.href)}
              style={{
                minWidth: 160,
                justifyContent: "flex-start",
              }}
            >
              {action.label}
            </ELButton>
          </Tooltip>
        ))}
      </ELFlex>
    </ELCard>
  );
}
