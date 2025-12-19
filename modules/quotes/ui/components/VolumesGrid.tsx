"use client";

import { DeleteOutlined, DownloadOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { useELApp, ELCol, ELForm, ELInputNumber, ELRow, ELSpace, ELTypography, ELUpload } from '@/shared/ui';
const App = { useApp: useELApp };
const Col = ELCol;
const Form = ELForm;
const InputNumber = ELInputNumber;
const Row = ELRow;
const Space = ELSpace;
const Typography = ELTypography;
const Upload = ELUpload;
import { ELButton, ELCard, ELFormItem } from '@/shared/ui';
import {
  Controller,
  type Control,
  type FieldArrayWithId,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { useEffect, useRef, useState, startTransition } from "react";
import type { QuoteFormValues } from "./quoteFormSchema";
import { MinhasEmbalagensSelect } from "@/modules/quotes/ui/components/MinhasEmbalagensSelect";
import type { PackagingTemplate } from "@/modules/quotes/ui/hooks";
import styles from "@/app/(envio)/cotacoes/cotacoes.module.css";

export const DEFAULT_CUBAGE_FACTOR = 6000;

type VolumeImportRow = {
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  pesoKg: number;
};

type VolumesGridProps = {
  control: Control<QuoteFormValues>;
  fields: FieldArrayWithId<QuoteFormValues, "volumes", "id">[];
  values: QuoteFormValues["volumes"];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onImport: (volumes: VolumeImportRow[]) => void;
  maxCount: number;
  /** @deprecated No longer used - totals are computed internally */
  totals?: { pesoRealKg: number; pesoCubadoKg: number };
  disableRemove?: boolean;
};

const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00";

// Parser que aceita tanto vírgula quanto ponto como separador decimal
const parseDecimal = (value: string | undefined): number => {
  if (!value) return 0;
  const normalized = value.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

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
  const { setValue, trigger } = useFormContext<QuoteFormValues>();
  const [selectedPackagingId, setSelectedPackagingId] = useState<string | undefined>();
  const [packagingSnapshot, setPackagingSnapshot] = useState<{
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  } | null>(null);

  // Ref para dar foco no campo de peso após selecionar embalagem
  // InputNumber expõe ref com método focus()
  const pesoInputRef = useRef<any>(null);

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
      startTransition(() => {
        setSelectedPackagingId(undefined);
        setPackagingSnapshot(null);
      });
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

      // Dar foco no campo de peso após aplicar dimensões
      setTimeout(() => {
        pesoInputRef.current?.focus();
      }, 100);
    } else {
      // Limpar seleção
      setSelectedPackagingId(undefined);
      setPackagingSnapshot(null);
    }
  };

  const cubageKg = computeCubage(volumeValue, DEFAULT_CUBAGE_FACTOR);

  return (
    <ELCard
      key={field.id}
      className={styles.volumeCard}
      data-testid={`volume-card-${index}`}
      title={
        <span className={styles.volumeHeader}>Volume {index + 1}</span>
      }
      size="small"
      extra={
        <ELButton
          variant="text"
          danger
          icon={<DeleteOutlined />}
          disabled={!canRemove}
          onClick={onRemove}
        />
      }
      styles={{
        body: { padding: 12 },
      }}
      padding="sm"
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
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
              <Col xs={24} sm={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.comprimentoCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label={
                          <div style={{ lineHeight: "1.2" }}>
                            <div className={styles.fieldLabelSm}>Comprimento</div>
                            <Typography.Text type="secondary" style={{ fontSize: "11px" }}>
                              cm
                            </Typography.Text>
                          </div>
                        }
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
                          parser={parseDecimal}
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
              <Col xs={24} sm={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.larguraCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label={
                          <div style={{ lineHeight: "1.2" }}>
                            <div className={styles.fieldLabelSm}>Largura</div>
                            <Typography.Text type="secondary" style={{ fontSize: "11px" }}>
                              cm
                            </Typography.Text>
                          </div>
                        }
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
                          parser={parseDecimal}
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
              <Col xs={24} sm={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.alturaCm`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label={
                          <div style={{ lineHeight: "1.2" }}>
                            <div className={styles.fieldLabelSm}>Altura</div>
                            <Typography.Text type="secondary" style={{ fontSize: "11px" }}>
                              cm
                            </Typography.Text>
                          </div>
                        }
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
                          parser={parseDecimal}
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
              <Col xs={24} sm={12} md={6}>
                <Controller
                  control={control}
                  name={`volumes.${index}.pesoKg`}
                  render={({ field: controllerField, fieldState }) => {
                    const showError =
                      fieldState.error &&
                      (fieldState.isDirty || fieldState.isTouched);
                    return (
                      <Form.Item
                        label={
                          <div style={{ lineHeight: "1.2" }}>
                            <div className={styles.fieldLabelSm}>Peso</div>
                            <Typography.Text type="secondary" style={{ fontSize: "11px" }}>
                              kg
                            </Typography.Text>
                          </div>
                        }
                        validateStatus={showError ? "error" : undefined}
                        help={showError ? fieldState.error?.message : undefined}
                      >
                        <InputNumber
                          {...controllerField}
                          ref={pesoInputRef}
                          value={controllerField.value ?? undefined}
                          min={0}
                          step={0.1}
                          precision={2}
                          placeholder="0,00"
                          parser={parseDecimal}
                          status={showError ? "error" : undefined}
                          onChange={(value) =>
                            controllerField.onChange(value ?? undefined)
                          }
                          onFocus={(e) => {
                            // Selecionar todo o texto ao receber foco para facilitar digitação
                            e.target.select();
                          }}
                          onBlur={async () => {
                            // Forçar recálculo do peso cubado ao sair do campo
                            controllerField.onBlur();

                            // Trigger para forçar recálculo dos totais
                            // Isso garante que o watch() no componente pai detecte a mudança
                            await trigger(`volumes.${index}.pesoKg`);
                          }}
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
    </ELCard>
  );
}

export function VolumesGrid({
  control,
  fields,
  values,
  onAdd,
  onRemove,
  onImport,
  maxCount,
  disableRemove,
}: VolumesGridProps) {
  const { message } = App.useApp();
  const addDisabled = fields.length >= maxCount;

  const handleDownloadTemplate = () => {
    const csvContent =
      "comprimento,largura,altura,peso\n" +
      "30,20,15,1.5\n" +
      "40,30,20,2.0\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo_volumes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());

        if (lines.length < 2) {
          message.error("O arquivo CSV deve conter pelo menos uma linha de dados além do cabeçalho.");
          return;
        }

        const volumes: VolumeImportRow[] = [];
        const errors: string[] = [];

        // Pular cabeçalho (primeira linha)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Suportar vírgula ou ponto-e-vírgula como delimitador
          const delimiter = line.includes(";") ? ";" : ",";
          const parts = line.split(delimiter).map((p) => p.trim());

          if (parts.length < 4) {
            errors.push(`Linha ${i + 1}: formato inválido (esperado: comprimento,largura,altura,peso)`);
            continue;
          }

          // Converter valores (suportar vírgula decimal)
          const parseNum = (val: string) => {
            const normalized = val.replace(",", ".");
            return parseFloat(normalized);
          };

          const comprimentoCm = parseNum(parts[0]);
          const larguraCm = parseNum(parts[1]);
          const alturaCm = parseNum(parts[2]);
          const pesoKg = parseNum(parts[3]);

          if (isNaN(comprimentoCm) || isNaN(larguraCm) || isNaN(alturaCm) || isNaN(pesoKg)) {
            errors.push(`Linha ${i + 1}: valores numéricos inválidos`);
            continue;
          }

          if (comprimentoCm <= 0 || larguraCm <= 0 || alturaCm <= 0 || pesoKg <= 0) {
            errors.push(`Linha ${i + 1}: valores devem ser maiores que zero`);
            continue;
          }

          volumes.push({ comprimentoCm, larguraCm, alturaCm, pesoKg });
        }

        if (volumes.length === 0) {
          message.error("Nenhum volume válido encontrado no arquivo.");
          return;
        }

        // Verificar limite
        if (volumes.length > maxCount) {
          message.warning(`Importados apenas os primeiros ${maxCount} volumes (limite máximo).`);
          volumes.splice(maxCount);
        }

        onImport(volumes);
        message.success(`${volumes.length} volume(s) importado(s) com sucesso!`);

        if (errors.length > 0) {
          message.warning(`${errors.length} linha(s) com erro foram ignoradas.`);
        }
      } catch (error) {
        message.error("Erro ao processar o arquivo CSV.");
        console.error(error);
      }
    };

    reader.readAsText(file);
    return false; // Impedir upload automático
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      {/* Botões de importação */}
      <Space size={8}>
        <ELButton
          size="small"
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
        >
          Baixar modelo
        </ELButton>
        <Upload
          accept=".csv"
          showUploadList={false}
          beforeUpload={handleImportCSV}
        >
          <ELButton size="small" icon={<UploadOutlined />}>
            Importar volumes
          </ELButton>
        </Upload>
      </Space>

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
        <ELButton
          variant="dashed"
          icon={<PlusOutlined />}
          onClick={onAdd}
          disabled={addDisabled}
        >
          Adicionar volume
        </ELButton>
      </div>
      {addDisabled ? (
        <Typography.Text type="secondary">
          Limite máximo de {maxCount} volumes atingido.
        </Typography.Text>
      ) : null}
    </Space>
  );
}
