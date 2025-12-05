"use client";

import { useState, useEffect } from "react";
import { Collapse, Space, Typography, Tag, Alert, Button, InputNumber, Row, Col } from "antd";
import {
  LockOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useFormContext } from "react-hook-form";
import type { FinalizeFormValues, DeclarationFormItem } from "@/types/quoteFinalize";
import { generateUUID } from "@/lib/utils/uuid";
import { RecurringItemAutocompleteInput } from "./RecurringItemAutocompleteInput";

interface VolumeDeclarationTabProps {
  volumeCount: number;
}

export function VolumeDeclarationTab({ volumeCount }: VolumeDeclarationTabProps) {
  const { watch, setValue } = useFormContext<FinalizeFormValues>();
  const volumeDocuments = watch("document.volumeDocuments") ?? [];
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  // Limpar o focusItemId após um curto delay para garantir que o foco foi aplicado
  useEffect(() => {
    if (focusItemId) {
      const timer = setTimeout(() => {
        setFocusItemId(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusItemId]);

  // Verificar se um volume está bloqueado (já tem NF-e)
  const isBlocked = (index: number): boolean => {
    const vol = volumeDocuments[index];
    return vol?.type === "NFE" && !!vol?.nfeKey && vol.nfeKey.length === 44;
  };

  // Verificar se um volume já tem declaração preenchida
  const hasDeclaration = (index: number): boolean => {
    const vol = volumeDocuments[index];
    return (
      vol?.type === "DECLARACAO" &&
      vol?.declarationItems !== undefined &&
      vol.declarationItems.length > 0 &&
      vol.declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0)
    );
  };

  // Calcular total de um volume
  const getVolumeTotal = (index: number): number => {
    const vol = volumeDocuments[index];
    if (!vol?.declarationItems) return 0;
    return vol.declarationItems.reduce((acc, item) => {
      const unit = Number(item.valorUnitario) || 0;
      const qty = Number(item.quantidade) || 0;
      return acc + unit * qty;
    }, 0);
  };

  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  // Adicionar item à declaração de um volume
  const addItem = (index: number) => {
    const docs = [...volumeDocuments];
    if (!docs[index]) {
      docs[index] = { volumeIndex: index, type: null };
    }
    const currentItems = docs[index].declarationItems ?? [];
    const newItemId = generateUUID();
    docs[index] = {
      ...docs[index],
      type: "DECLARACAO",
      declarationItems: [
        ...currentItems,
        { id: newItemId, descricao: "", valorUnitario: 0, quantidade: 1 },
      ],
    };
    setValue("document.volumeDocuments", docs, { shouldDirty: true });
    setFocusItemId(newItemId);
  };

  // Remover item de um volume
  const removeItem = (volumeIndex: number, itemId: string) => {
    const docs = [...volumeDocuments];
    if (!docs[volumeIndex]?.declarationItems) return;
    const items = docs[volumeIndex].declarationItems!.filter((item) => item.id !== itemId);
    docs[volumeIndex] = {
      ...docs[volumeIndex],
      declarationItems: items,
      type: items.length > 0 ? "DECLARACAO" : null,
    };
    setValue("document.volumeDocuments", docs, { shouldDirty: true });
  };

  // Atualizar item
  const updateItem = (
    volumeIndex: number,
    itemId: string,
    field: keyof DeclarationFormItem,
    value: string | number | undefined
  ) => {
    const docs = [...volumeDocuments];
    if (!docs[volumeIndex]?.declarationItems) return;
    const items = docs[volumeIndex].declarationItems!.map((item) =>
      item.id === itemId ? { ...item, [field]: value } : item
    );
    docs[volumeIndex] = {
      ...docs[volumeIndex],
      declarationItems: items,
    };
    setValue("document.volumeDocuments", docs, { shouldDirty: true });
  };

  // Handler para quando um item recorrente é selecionado do autocomplete
  const handleRecurringItemSelect = (
    volumeIndex: number,
    itemId: string,
    descricao: string,
    valorUnitario: number
  ) => {
    const docs = [...volumeDocuments];
    if (!docs[volumeIndex]?.declarationItems) return;
    const items = docs[volumeIndex].declarationItems!.map((item) =>
      item.id === itemId ? { ...item, descricao, valorUnitario } : item
    );
    docs[volumeIndex] = {
      ...docs[volumeIndex],
      declarationItems: items,
    };
    setValue("document.volumeDocuments", docs, { shouldDirty: true });
  };

  // Limpar declaração de um volume
  const clearDeclaration = (index: number) => {
    const docs = [...volumeDocuments];
    if (docs[index]) {
      docs[index] = {
        ...docs[index],
        type: null,
        declarationItems: undefined,
      };
      setValue("document.volumeDocuments", docs, { shouldDirty: true });
    }
  };

  // Contar preenchidos
  const filledCount = volumeDocuments.filter(
    (v) =>
      v?.type === "DECLARACAO" &&
      v?.declarationItems &&
      v.declarationItems.some((item) => item.descricao && item.descricao.trim().length > 0)
  ).length;

  // Renderizar formulário de declaração para um volume
  const renderDeclarationForm = (index: number) => {
    const vol = volumeDocuments[index];
    const items = vol?.declarationItems ?? [];

    return (
      <Space orientation="vertical" style={{ width: "100%" }} size={12}>
        {items.map((item) => (
          <Row key={item.id} gutter={8} align="middle">
            <Col flex="auto">
              <RecurringItemAutocompleteInput
                value={item.descricao ?? ""}
                onChange={(value) => updateItem(index, item.id, "descricao", value)}
                onSelect={(descricao, valorUnitario) =>
                  handleRecurringItemSelect(index, item.id, descricao, valorUnitario)
                }
                placeholder="Ex.: Camiseta algodão"
                autoFocus={item.id === focusItemId}
              />
            </Col>
            <Col>
              <InputNumber
                placeholder="Valor unit."
                min={0}
                precision={2}
                prefix="R$"
                style={{ width: 120 }}
                value={item.valorUnitario}
                onChange={(val) => updateItem(index, item.id, "valorUnitario", val ?? 0)}
              />
            </Col>
            <Col>
              <InputNumber
                placeholder="Qtd"
                min={1}
                style={{ width: 80 }}
                value={item.quantidade}
                onChange={(val) => updateItem(index, item.id, "quantidade", val ?? 1)}
              />
            </Col>
            <Col>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeItem(index, item.id)}
              />
            </Col>
          </Row>
        ))}
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => addItem(index)} block>
          Adicionar item
        </Button>
      </Space>
    );
  };

  // Se apenas 1 volume, mostrar interface simplificada
  if (volumeCount === 1) {
    const blocked = isBlocked(0);
    const filled = hasDeclaration(0);
    const total = getVolumeTotal(0);

    if (blocked) {
      return (
        <Alert
          type="warning"
          icon={<LockOutlined />}
          message="Volume com Nota Fiscal"
          description="Este volume já possui uma NF-e. Remova a NF-e na aba correspondente para usar Declaração."
          showIcon
        />
      );
    }

    return (
      <Space orientation="vertical" style={{ width: "100%" }} size={16}>
        {filled && (
          <Space>
            <Tag color="blue">Total: {currency.format(total)}</Tag>
            <Button size="small" danger onClick={() => clearDeclaration(0)}>
              Limpar declaração
            </Button>
          </Space>
        )}
        {renderDeclarationForm(0)}
      </Space>
    );
  }

  // Múltiplos volumes - usar Collapse
  const items = Array.from({ length: volumeCount }, (_, index) => {
    const blocked = isBlocked(index);
    const filled = hasDeclaration(index);
    const total = getVolumeTotal(index);

    return {
      key: index.toString(),
      label: (
        <Space>
          <span>Volume {index + 1}</span>
          {blocked && <Tag icon={<LockOutlined />} color="warning">Com NF-e</Tag>}
          {filled && (
            <>
              <Tag icon={<CheckCircleOutlined />} color="success">Declaração OK</Tag>
              {total > 0 && <Tag color="blue">Total: {currency.format(total)}</Tag>}
            </>
          )}
        </Space>
      ),
      children: blocked ? (
        <Alert
          type="warning"
          icon={<LockOutlined />}
          message="Volume com Nota Fiscal"
          description="Remova a NF-e na aba correspondente para usar Declaração neste volume."
          showIcon
        />
      ) : (
        <Space orientation="vertical" style={{ width: "100%" }} size={12}>
          {filled && (
            <Button size="small" danger onClick={() => clearDeclaration(index)}>
              Limpar declaração
            </Button>
          )}
          {renderDeclarationForm(index)}
        </Space>
      ),
      collapsible: blocked ? ("disabled" as const) : undefined,
    };
  });

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      <Typography.Text type="secondary">
        {filledCount} de {volumeCount} volume(s) com Declaração
      </Typography.Text>
      <Collapse items={items} defaultActiveKey={["0"]} />
    </Space>
  );
}
