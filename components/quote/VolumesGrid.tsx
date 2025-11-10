"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, InputNumber, Row, Space, Typography } from "antd";
import {
  Controller,
  type Control,
  type FieldArrayWithId,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { useEffect, useRef, useState } from "react";
import type { QuoteFormValues } from "./QuoteForm";
import { MinhasEmbalagensSelect } from "@/components/cotacoes/MinhasEmbalagensSelect";
import type { PackagingTemplate } from "@/hooks/usePackaging";
import styles from "@/app/(dashboard)/cotacoes/cotacoes.module.css";

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

// Componente interno para gerenciar um volume individual
function VolumeItem({
  index,
  field,
  control,
  volumeValue,
  canRemove,
  onRemove,
}: {
  index: number;
  field: FieldArrayWithId<QuoteFormValues, "volumes", "id">;
  control: Control<QuoteFormValues>;
  volumeValue: QuoteFormValues["volumes"][number];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { setValue } = useFormContext<QuoteFormValues>();
  const [selectedPackagingId, setSelectedPackagingId] = useState<string | undefined>();
  const [packagingSnapshot, setPackagingSnapshot] = useState<{
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  } | null>(null);

  // Observar mudanças nos campos de medida
  const comprimentoCm = useWatch({ control, name: `volumes.${index}.comprimentoCm` });
  const larguraCm = useWatch({ control, name: `volumes.${index}.larguraCm` });
  const alturaCm = useWatch({ control, name: `volumes.${index}.alturaCm` });

  // Comparar valores arredondados (2 casas decimais)
  const round = (val: number | undefined) => {
    if (val === undefined || val === null) return 0;
    return Math.round(Number(val) * 100) / 100;
  };

  // Verificar se o usuário editou manualmente alguma medida
  useEffect(() => {
    if (!packagingSnapshot || !selectedPackagingId) return;

    const currentLength = round(comprimentoCm);
    const currentWidth = round(larguraCm);
    const currentHeight = round(alturaCm);

    const snapshotLength = round(packagingSnapshot.lengthCm);
    const snapshotWidth = round(packagingSnapshot.widthCm);
    const snapshotHeight = round(packagingSnapshot.heightCm);

    // Se qualquer valor diferir do snapshot, desassociar
    if (
      currentLength !== snapshotLength ||
      currentWidth !== snapshotWidth ||
      currentHeight !== snapshotHeight
    ) {
      setSelectedPackagingId(undefined);
      setPackagingSnapshot(null);
    }
  }, [comprimentoCm, larguraCm, alturaCm, packagingSnapshot, selectedPackagingId]);

  const handlePackagingSelect = (value: string | undefined, template: PackagingTemplate | undefined) => {
    if (template) {
      // Preencher os campos do volume com as dimensões da embalagem
      setValue(`volumes.${index}.comprimentoCm`, template.lengthCm, { shouldDirty: true });
      setValue(`volumes.${index}.larguraCm`, template.widthCm, { shouldDirty: true });
      setValue(`volumes.${index}.alturaCm`, template.heightCm, { shouldDirty: true });

      // Salvar snapshot para detectar edições manuais
      setPackagingSnapshot({
        lengthCm: template.lengthCm,
        widthCm: template.widthCm,
        heightCm: template.heightCm,
      });
      setSelectedPackagingId(value);
    } else {
      // Limpar seleção
      setSelectedPackagingId(undefined);
      setPackagingSnapshot(null);
    }
  };

  const cubageKg = computeCubage(volumeValue, DEFAULT_CUBAGE_FACTOR);

  return (
    <Card
      key={field.id}
      className={styles.volumeCard}
      data-testid={`volume-card-${index}`}
      title={
        <span className={styles.volumeHeader}>Volume {index + 1}</span>
      }
      size="small"
      extra={
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={!canRemove}
          onClick={onRemove}
        />
      }
      styles={{
        body: { padding: 12 },
      }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Form.Item
          label={<span className={styles.fieldLabelSm}>Minhas embalagens</span>}
          style={{ marginBottom: 0 }}
        >
          <MinhasEmbalagensSelect
            value={selectedPackagingId}
            placeholder="Selecione uma embalagem salva"
            onChange={handlePackagingSelect}
          />
        </Form.Item>

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
                        label={<span className={styles.fieldLabelSm}>Comprimento (cm)</span>}
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
                        label={<span className={styles.fieldLabelSm}>Largura (cm)</span>}
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
                        label={<span className={styles.fieldLabelSm}>Altura (cm)</span>}
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
                        label={<span className={styles.fieldLabelSm}>Peso (kg)</span>}
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
      </Space>
    </Card>
  );
}

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
        const canRemove = !disableRemove && fields.length > 1;
        return (
          <VolumeItem
            key={field.id}
            index={index}
            field={field}
            control={control}
            volumeValue={volumeValue}
            canRemove={canRemove}
            onRemove={() => onRemove(index)}
          />
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
