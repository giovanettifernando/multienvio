"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Flex,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
} from "antd";
import { ELButton } from "@/components/ui/ELButton";
import { ELCard } from "@/components/ui/ELCard";
import {
  Controller,
  useFieldArray,
  useFormContext,
} from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import styles from "@/app/(envio)/cotacoes/cotacoes.module.css";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/lib/utils/format";
import { generateUUID } from "@/lib/utils/uuid";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function DeclarationItems() {
  const { control, watch } = useFormContext<FinalizeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "document.declarationItems",
  });

  const items = watch("document.declarationItems");
  const total = items?.reduce((acc, item) => {
    const unit = Number(item.valorUnitario) || 0;
    const quantity = Number(item.quantidade) || 0;
    return acc + unit * quantity;
  }, 0) ?? 0;

  const handleAddItem = () => {
    append({
      id: generateUUID(),
      descricao: "",
      valorUnitario: 0,
      quantidade: 1,
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      {fields.map((field, index) => (
        <ELCard
          key={field.id}
          className={styles.volumeCard}
          data-testid="declaration-items"
          header={{
            title: <span className={styles.volumeHeader}>Item {index + 1}</span>,
            extra: fields.length > 1 ? (
              <ELButton
                variant="ghost"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(index)}
              />
            ) : null,
          }}
          padding="md"
        >
          <Flex gap={12} wrap="wrap">
            <div style={{ flex: '2 1 200px', minWidth: 200 }}>
              <Controller
                control={control}
                name={`document.declarationItems.${index}.descricao`}
                render={({ field: controllerField, fieldState }) => (
                  <Form.Item
                    label={
                      <span className={styles.fieldLabelSm}>Descrição do item</span>
                    }
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={fieldState.error?.message}
                    style={{ marginBottom: 12 }}
                  >
                    <Input
                      {...controllerField}
                      placeholder="Ex.: Camiseta algodão"
                    />
                  </Form.Item>
                )}
              />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 120 }}>
              <Controller
                control={control}
                name={`document.declarationItems.${index}.valorUnitario`}
                render={({ field: controllerField, fieldState }) => (
                  <Form.Item
                    label={
                      <span className={styles.fieldLabelSm}>Valor unitário (R$)</span>
                    }
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={fieldState.error?.message}
                    style={{ marginBottom: 12 }}
                  >
                    <InputNumber
                      {...controllerField}
                      value={controllerField.value ?? undefined}
                      min={0}
                      step={1}
                      precision={2}
                      prefix="R$"
                      decimalSeparator=","
                      formatter={inputNumberFormatterBRL}
                      parser={inputNumberParserBRL}
                      style={{ width: "100%" }}
                      onChange={(value) =>
                        controllerField.onChange(value ?? undefined)
                      }
                    />
                  </Form.Item>
                )}
              />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 120 }}>
              <Controller
                control={control}
                name={`document.declarationItems.${index}.quantidade`}
                render={({ field: controllerField, fieldState }) => (
                  <Form.Item
                    label={<span className={styles.fieldLabelSm}>Quantidade</span>}
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={fieldState.error?.message}
                    style={{ marginBottom: 12 }}
                  >
                    <InputNumber
                      {...controllerField}
                      value={controllerField.value ?? undefined}
                      min={1}
                      step={1}
                      style={{ width: "100%" }}
                      onChange={(value) =>
                        controllerField.onChange(value ?? undefined)
                      }
                    />
                  </Form.Item>
                )}
              />
            </div>
          </Flex>
        </ELCard>
      ))}

      <ELButton variant="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
        Adicionar item
      </ELButton>

      <Typography.Text strong>
        Total da declaração: {currency.format(total)}
      </Typography.Text>
    </Space>
  );
}
