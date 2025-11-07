"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, InputNumber, Row, Space, Typography } from "antd";
import {
  Controller,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import type { QuoteFormValues } from "./QuoteForm";

export const DEFAULT_CUBAGE_FACTOR = 6000;

type VolumesGridProps = {
  control: Control<QuoteFormValues>;
  fields: FieldArrayWithId<QuoteFormValues, "volumes", "id">[];
  values: QuoteFormValues["volumes"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  maxCount: number;
  totals: { pesoRealKg: number; pesoCubadoKg: number };
  disableRemove?: boolean;
};

const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";

const computeCubage = (
  volume: QuoteFormValues["volumes"][number],
  fator: number,
) => {
  const { comprimentoCm, larguraCm, alturaCm } = volume ?? {};
  const length = Number(comprimentoCm) || 0;
  const width = Number(larguraCm) || 0;
  const height = Number(alturaCm) || 0;
  if (!length || !width || !height) {
    return 0;
  }
  return (length * width * height) / fator;
};

export function VolumesGrid({
  control,
  fields,
  values,
  onAdd,
  onRemove,
  maxCount,
  totals,
  disableRemove,
}: VolumesGridProps) {
  const addDisabled = fields.length >= maxCount;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {fields.map((field, index) => {
        const volumeValue = values?.[index];
        const cubageKg = computeCubage(volumeValue, DEFAULT_CUBAGE_FACTOR);
        const canRemove = !disableRemove && fields.length > 1;
        return (
          <Card
            key={field.id}
            title={`Volume ${index + 1}`}
            size="small"
            extra={
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={!canRemove}
                onClick={() => onRemove(index)}
              />
            }
          >
            <Row gutter={[16, 12]}>
              <Col xs={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.comprimentoCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label="Comprimento (cm)"
                        validateStatus={showError ? "error" : undefined}
                        help={showError ? fieldState.error?.message : undefined}
                      >
                        <InputNumber
                          {...controllerField}
                          value={controllerField.value ?? undefined}
                          min={0}
                          step={1}
                          precision={0}
                          placeholder="0"
                          status={showError ? "error" : undefined}
                          onChange={(value) =>
                            controllerField.onChange(value ?? undefined)
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    );
                  }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.larguraCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label="Largura (cm)"
                        validateStatus={showError ? "error" : undefined}
                        help={showError ? fieldState.error?.message : undefined}
                      >
                        <InputNumber
                          {...controllerField}
                          value={controllerField.value ?? undefined}
                          min={0}
                          step={1}
                          precision={0}
                          placeholder="0"
                          status={showError ? "error" : undefined}
                          onChange={(value) =>
                            controllerField.onChange(value ?? undefined)
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    );
                  }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.alturaCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label="Altura (cm)"
                        validateStatus={showError ? "error" : undefined}
                        help={showError ? fieldState.error?.message : undefined}
                      >
                        <InputNumber
                          {...controllerField}
                          value={controllerField.value ?? undefined}
                          min={0}
                          step={1}
                          precision={0}
                          placeholder="0"
                          status={showError ? "error" : undefined}
                          onChange={(value) =>
                            controllerField.onChange(value ?? undefined)
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    );
                  }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.pesoKg`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label="Peso (kg)"
                        validateStatus={showError ? "error" : undefined}
                        help={showError ? fieldState.error?.message : undefined}
                      >
                        <InputNumber
                          {...controllerField}
                          value={controllerField.value ?? undefined}
                          min={0}
                          step={0.1}
                          precision={2}
                          placeholder="0,00"
                          status={showError ? "error" : undefined}
                          onChange={(value) =>
                            controllerField.onChange(value ?? undefined)
                          }
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    );
                  }}
                />
              </Col>
            </Row>
            <div>
              <Typography.Text type="secondary">
                Peso cubado:
              </Typography.Text>{" "}
              <strong>{formatNumber(cubageKg)} kg</strong>
            </div>
          </Card>
        );
      })}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={onAdd}
          disabled={addDisabled}
        >
          Adicionar volume
        </Button>
      </div>
      {addDisabled ? (
        <Typography.Text type="secondary">
          Limite máximo de {maxCount} volumes atingido.
        </Typography.Text>
      ) : null}
    </Space>
  );
}
