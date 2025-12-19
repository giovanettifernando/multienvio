"use client";

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  ELFlexAntd,
  ELForm,
  ELInputNumber,
  ELSpace,
} from '@/shared/ui';
const Flex = ELFlexAntd;
const Form = ELForm;
const InputNumber = ELInputNumber;
const Space = ELSpace;
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import {
  Controller,
  useFieldArray,
  useFormContext,
} from "react-hook-form";
import type { FinalizeFormValues } from '@/shared/types/quoteFinalize';
import styles from "@/app/(envio)/cotacoes/cotacoes.module.css";
import { RecurringItemAutocompleteInput } from "./RecurringItemAutocompleteInput";
import { generateUUID } from "@/shared/utils/uuid";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/shared/utils/format";

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
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 120 }}>
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
            </div>
          </Flex>
        </ELCard>
      ))}

      <ELButton variant="dashed" icon={<PlusOutlined />} onClick={handleAddItem}>
        Adicionar item
      </ELButton>
    </Space>
  );
}
