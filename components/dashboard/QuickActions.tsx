"use client";

import {
  CalendarOutlined,
  CloudUploadOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  RocketOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Card, Flex, Tooltip } from "antd";
import { useRouter } from "next/navigation";

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
    label: "Criar devolução",
    description: "Fluxo logística reversa",
    href: "/devolucoes/nova",
    icon: <RocketOutlined />,
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
    <Card
      title="Ações rápidas"
      variant="borderless"
      styles={{ body: { paddingTop: 16 } }}
    >
      <Flex gap={12} wrap>
        {ACTIONS.map((action) => (
          <Tooltip key={action.label} title={action.description} placement="bottom">
            <Button
              type="default"
              size="large"
              icon={action.icon}
              onClick={() => router.push(action.href)}
              style={{
                minWidth: 160,
                justifyContent: "flex-start",
              }}
            >
              {action.label}
            </Button>
          </Tooltip>
        ))}
      </Flex>
    </Card>
  );
}
