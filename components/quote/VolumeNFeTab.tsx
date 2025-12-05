"use client";

import { useState } from "react";
import {
  App,
  Collapse,
  Space,
  Typography,
  Tag,
  Upload,
  Button,
  Alert,
  Table,
  Descriptions,
} from "antd";
import type { UploadProps } from "antd";
import {
  InboxOutlined,
  LockOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { useFormContext } from "react-hook-form";
import type { FinalizeFormValues, VolumeDocument } from "@/types/quoteFinalize";

const { Dragger } = Upload;

interface VolumeNFeTabProps {
  volumeCount: number;
}

interface NFeItem {
  id: string;
  sku?: string | null;
  descricao: string;
  ncm?: string | null;
  cfop?: string | null;
  quantidade: number;
  pesoLiquido?: number | null;
  valorUnitario: number;
  valorTotal: number;
}

function extractNFeKeyFromXml(text: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const inf = doc.querySelector("infNFe");
    const id = inf?.getAttribute("Id") || inf?.getAttribute("id");
    if (id) {
      const digits = id.replace(/[^0-9]/g, "");
      if (digits.length === 44) return digits;
    }
    const chNode = doc.querySelector("chNFe");
    const ch = chNode?.textContent?.trim();
    if (ch && /^\d{44}$/.test(ch)) return ch;
    return null;
  } catch {
    return null;
  }
}

// Formatar chave NF-e com espaços para melhor legibilidade
function formatNFeKey(key: string): string {
  return key.replace(/(\d{4})/g, "$1 ").trim();
}

// Formatar moeda
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

// Componente para exibir detalhes da NF-e com itens
function NFeDetails({
  vol,
  onRemove,
}: {
  vol: VolumeDocument;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = vol.nfeItems ?? [];
  const totalValue = items.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
  const totalQty = items.reduce((acc, item) => acc + (item.quantidade || 0), 0);

  const columns = [
    {
      title: "Descrição",
      dataIndex: "descricao",
      key: "descricao",
      ellipsis: true,
    },
    {
      title: "NCM",
      dataIndex: "ncm",
      key: "ncm",
      width: 100,
      render: (v: string | null) => v || "-",
    },
    {
      title: "Qtd",
      dataIndex: "quantidade",
      key: "quantidade",
      width: 60,
      align: "right" as const,
    },
    {
      title: "Valor Unit.",
      dataIndex: "valorUnitario",
      key: "valorUnitario",
      width: 110,
      align: "right" as const,
      render: (v: number) => currency.format(v),
    },
    {
      title: "Total",
      dataIndex: "valorTotal",
      key: "valorTotal",
      width: 110,
      align: "right" as const,
      render: (v: number) => currency.format(v),
    },
  ];

  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={12}>
      {/* Header com chave e ações */}
      <Alert
        type="success"
        icon={<CheckCircleOutlined />}
        title={
          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
            <Typography.Text strong>
              <FileTextOutlined style={{ marginRight: 8 }} />
              NF-e carregada com sucesso
            </Typography.Text>
            <Typography.Text copyable={{ text: vol.nfeKey }} style={{ fontFamily: "monospace", fontSize: 12 }}>
              {formatNFeKey(vol.nfeKey || "")}
            </Typography.Text>
          </Space>
        }
        action={
          <Button size="small" danger icon={<DeleteOutlined />} onClick={onRemove}>
            Remover
          </Button>
        }
        showIcon
      />

      {/* Resumo */}
      {items.length > 0 && (
        <Descriptions size="small" column={3} bordered>
          <Descriptions.Item label="Itens">{items.length}</Descriptions.Item>
          <Descriptions.Item label="Qtd Total">{totalQty}</Descriptions.Item>
          <Descriptions.Item label="Valor Total">{currency.format(totalValue)}</Descriptions.Item>
        </Descriptions>
      )}

      {/* Botão para expandir/recolher itens */}
      {items.length > 0 && (
        <Button
          type="link"
          size="small"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setExpanded(!expanded)}
          style={{ padding: 0 }}
        >
          {expanded ? "Ocultar itens" : `Ver ${items.length} item(ns) da NF-e`}
        </Button>
      )}

      {/* Tabela de itens (colapsável) */}
      {expanded && items.length > 0 && (
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 500 }}
          style={{ marginTop: 8 }}
        />
      )}
    </Space>
  );
}

export function VolumeNFeTab({ volumeCount }: VolumeNFeTabProps) {
  const { message } = App.useApp();
  const { watch, setValue } = useFormContext<FinalizeFormValues>();
  const volumeDocuments = watch("document.volumeDocuments") ?? [];
  const [loading, setLoading] = useState(false);

  // Verificar se um volume está bloqueado (já tem declaração)
  const isBlocked = (index: number): boolean => {
    const vol = volumeDocuments[index];
    return (
      vol?.type === "DECLARACAO" &&
      vol?.declarationItems !== undefined &&
      vol.declarationItems.length > 0 &&
      vol.declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0)
    );
  };

  // Verificar se um volume já tem NF-e preenchida
  const hasNfe = (index: number): boolean => {
    const vol = volumeDocuments[index];
    return vol?.type === "NFE" && !!vol?.nfeKey && vol.nfeKey.length === 44;
  };

  // Encontrar próximo volume disponível (não bloqueado e sem NF-e)
  const findNextAvailableVolumeIndex = (): number => {
    for (let i = 0; i < volumeCount; i++) {
      if (!isBlocked(i) && !hasNfe(i)) {
        return i;
      }
    }
    return -1; // Todos os volumes já estão preenchidos ou bloqueados
  };

  // Processar um único XML e associar ao volume especificado
  const processXml = async (xml: string, targetIndex: number): Promise<boolean> => {
    try {
      const chave = extractNFeKeyFromXml(xml);
      if (!chave) {
        return false;
      }

      // Parsear o XML para obter itens e dados completos
      const response = await fetch("/api/nfe/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });

      const result = await response.json();

      const docs = [...volumeDocuments];
      if (!docs[targetIndex]) {
        docs[targetIndex] = { volumeIndex: targetIndex, type: null };
      }
      docs[targetIndex] = {
        ...docs[targetIndex],
        type: "NFE",
        nfeKey: chave,
        nfeItems: result.success ? result.data?.items : undefined,
        // Armazenar dados completos da NF-e para espelho
        nfeData: result.success ? result.data : undefined,
      };
      setValue("document.volumeDocuments", docs, { shouldDirty: true });
      return true;
    } catch {
      return false;
    }
  };

  const handleRemoveNfe = (index: number) => {
    const docs = [...volumeDocuments];
    if (docs[index]) {
      docs[index] = {
        ...docs[index],
        type: null,
        nfeKey: undefined,
        nfeXmlId: undefined,
        nfeItems: undefined,
        nfeData: undefined,
      };
      setValue("document.volumeDocuments", docs, { shouldDirty: true });
    }
  };

  // Upload props para múltiplos XMLs
  const uploadProps: UploadProps = {
    accept: ".xml,text/xml,application/xml",
    multiple: true,
    beforeUpload: async (file, fileList) => {
      // Processar apenas quando for o primeiro arquivo da lista
      // (evita processar múltiplas vezes)
      if (file !== fileList[0]) {
        return Upload.LIST_IGNORE;
      }

      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      const docs = [...volumeDocuments];

      // Processar cada arquivo em sequência
      for (const f of fileList) {
        // Encontrar próximo volume disponível
        let targetIndex = -1;
        for (let i = 0; i < volumeCount; i++) {
          const vol = docs[i];
          const blocked =
            vol?.type === "DECLARACAO" &&
            vol?.declarationItems !== undefined &&
            vol.declarationItems.length > 0 &&
            vol.declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0);
          const filled = vol?.type === "NFE" && !!vol?.nfeKey && vol.nfeKey.length === 44;

          if (!blocked && !filled) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex === -1) {
          message.warning(`Não há mais volumes disponíveis para associar NF-e.`);
          break;
        }

        try {
          const text = await f.text();
          const chave = extractNFeKeyFromXml(text);

          if (!chave) {
            errorCount++;
            message.error(`${f.name}: não foi possível extrair a chave da NF-e.`);
            continue;
          }

          // Parsear o XML para obter itens
          const response = await fetch("/api/nfe/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xml: text }),
          });

          const result = await response.json();

          if (!docs[targetIndex]) {
            docs[targetIndex] = { volumeIndex: targetIndex, type: null };
          }
          docs[targetIndex] = {
            ...docs[targetIndex],
            type: "NFE",
            nfeKey: chave,
            nfeItems: result.success ? result.data?.items : undefined,
            // Armazenar dados completos da NF-e para espelho
            nfeData: result.success ? result.data : undefined,
          };

          successCount++;
        } catch {
          errorCount++;
          message.error(`${f.name}: erro ao processar arquivo.`);
        }
      }

      // Atualizar estado do formulário
      setValue("document.volumeDocuments", docs, { shouldDirty: true });

      if (successCount > 0) {
        message.success(
          `${successCount} NF-e(s) carregada(s) com sucesso${errorCount > 0 ? ` (${errorCount} com erro)` : ""}`
        );
      }

      setLoading(false);
      return Upload.LIST_IGNORE;
    },
    showUploadList: false,
  };

  // Contar preenchidos e disponíveis
  const filledCount = volumeDocuments.filter((v) => v?.type === "NFE" && v?.nfeKey).length;
  const availableCount = Array.from({ length: volumeCount }, (_, i) => i).filter(
    (i) => !isBlocked(i) && !hasNfe(i)
  ).length;

  // Se apenas 1 volume, mostrar interface simplificada
  if (volumeCount === 1) {
    const blocked = isBlocked(0);
    const filled = hasNfe(0);
    const vol = volumeDocuments[0];

    if (blocked) {
      return (
        <Alert
          type="warning"
          icon={<LockOutlined />}
          message="Volume com Declaração de conteúdo"
          description="Este volume já possui uma declaração de conteúdo. Remova a declaração na aba correspondente para usar NF-e."
          showIcon
        />
      );
    }

    if (filled && vol) {
      return <NFeDetails vol={vol} onRemove={() => handleRemoveNfe(0)} />;
    }

    return (
      <Dragger {...uploadProps} disabled={loading}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {loading ? "Processando..." : "Arraste o XML da NF-e ou clique para selecionar"}
        </p>
        <p className="ant-upload-hint">Apenas arquivos XML de NF-e são aceitos</p>
      </Dragger>
    );
  }

  // Múltiplos volumes - mostrar lista com Collapse
  const collapseItems = Array.from({ length: volumeCount }, (_, index) => {
    const blocked = isBlocked(index);
    const filled = hasNfe(index);
    const vol = volumeDocuments[index];

    return {
      key: index.toString(),
      label: (
        <Space>
          <span>Volume {index + 1}</span>
          {blocked && (
            <Tag icon={<LockOutlined />} color="warning">
              Com Declaração
            </Tag>
          )}
          {filled && (
            <Tag icon={<CheckCircleOutlined />} color="success">
              NF-e OK
            </Tag>
          )}
          {!blocked && !filled && <Tag color="default">Aguardando</Tag>}
        </Space>
      ),
      children: blocked ? (
        <Alert
          type="warning"
          icon={<LockOutlined />}
          message="Volume com Declaração de conteúdo"
          description="Remova a declaração na aba correspondente para usar NF-e neste volume."
          showIcon
        />
      ) : filled && vol ? (
        <NFeDetails vol={vol} onRemove={() => handleRemoveNfe(index)} />
      ) : (
        <Typography.Text type="secondary">
          Arraste um XML na área acima para associar a este volume.
        </Typography.Text>
      ),
      collapsible: blocked ? ("disabled" as const) : undefined,
    };
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Space>
        <Typography.Text type="secondary">
          {filledCount} de {volumeCount} volume(s) com NF-e
        </Typography.Text>
        {availableCount > 0 && (
          <Tag color="blue">{availableCount} disponível(is)</Tag>
        )}
      </Space>

      {/* Upload global de XMLs */}
      {availableCount > 0 && (
        <Dragger {...uploadProps} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {loading
              ? "Processando..."
              : `Arraste os XMLs das NF-e ou clique para selecionar (${availableCount} volume(s) disponível)`}
          </p>
          <p className="ant-upload-hint">
            Os XMLs serão associados aos volumes em sequência, do primeiro ao último disponível
          </p>
        </Dragger>
      )}

      {/* Lista de volumes */}
      <Collapse items={collapseItems} defaultActiveKey={filledCount > 0 ? [] : ["0"]} />
    </Space>
  );
}
