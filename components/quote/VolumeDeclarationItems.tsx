"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
} from "antd";
import {
  Controller,
  useFieldArray,
  useFormContext,
} from "react-hook-form";
import type { FinalizeFormValues } from "@/types/quoteFinalize";
import styles from "@/app/(envio)/cotacoes/cotacoes.module.css";
import { RecurringItemAutocompleteInput } from "./RecurringItemAutocompleteInput";

type VolumeDeclarationItemsProps = {
  volumeIndex: number;
};

export function VolumeDeclarationItems({ volumeIndex }: VolumeDeclarationItemsProps) {
  const { control, setValue } = useFormContext<FinalizeFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `document.volumeDeclarations.${volumeIndex}.items`,
  });

  const handleAddItem = () => {
    append({
      id: crypto.randomUUID(),
      descricao: "",
      valorUnitario: 0,
      quantidade: 1,
    });
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {fields.map((field, index) => (
        <Card
          key={field.id}
          size="small"
          className={styles.volumeCard}
          data-testid="declaration-items"
          title={
            <span className={styles.volumeHeader}>
              Item {index + 1}
            </span>
          }
          extra={
            fields.length > 1 ? (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => remove(index)}
              />
            ) : null
          }
          styles={{
            body: { padding: 12 },
          }}
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Controller
                control={control}
                name={`document.volumeDeclarations.${volumeIndex}.items.${index}.descricao`}
                render={({ field: controllerField, fieldState }) => (
                  <Form.Item
                    label={
                      <span className={styles.fieldLabelSm}>Descrição do item</span>
                    }
                    validateStatus={fieldState.error ? "error" : undefined}
                    help={fieldState.error?.message}
                    style={{ marginBottom: 12 }}
                  >
                    <RecurringItemAutocompleteInput
                      value={controllerField.value}
                      onChange={controllerField.onChange}
                      onSelect={(descricao, valorUnitario) => {
                        controllerField.onChange(descricao);
                        setValue(
                          `document.volumeDeclarations.${volumeIndex}.items.${index}.valorUnitario`,
                          valorUnitario
                        );
                      }}
                      placeholder="Ex.: Camiseta algodão"
                    />
                  </Form.Item>
                )}
              />
            </Col>
            <Col xs={12} md={6}>
              <Controller
                control={control}
                name={`document.volumeDeclarations.${volumeIndex}.items.${index}.valorUnitario`}
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
                      style={{ width: "100%" }}
                      onChange={(value) =>
                        controllerField.onChange(value ?? undefined)
                      }
                    />
                  </Form.Item>
                )}
              />
            </Col>
            <Col xs={12} md={6}>
              <Controller
                control={control}
                name={`document.volumeDeclarations.${volumeIndex}.items.${index}.quantidade`}
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
            </Col>
          </Row>
        </Card>
      ))}

      <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
        Adicionar item
      </Button>
    </Space>
  );
}
