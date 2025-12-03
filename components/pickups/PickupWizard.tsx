"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Steps,
  TimePicker,
  Typography,
  message,
} from "antd";
import dayjs from "dayjs";
import type { CompanyWizardData } from "@/lib/validation/company";
import { getCompanyDisplayName } from "@/lib/validation/company";
import { pickupPayloadSchema } from "@/lib/validation/pickup";
import type { Shipment } from "@/types/shipment";
import { PickupShipmentsTable } from "@/components/pickups/PickupShipmentsTable";
import { PickupSummary } from "@/components/pickups/PickupSummary";

const carrierOptions = [
  { label: "Qualquer", value: "ANY" },
  { label: "Correios", value: "Correios" },
  { label: "Jadlog", value: "Jadlog" },
  { label: "Loggi", value: "Loggi" },
  { label: "J&T", value: "J&T" },
];

type PickupWizardProps = {
  sender: CompanyWizardData;
  shipments: Shipment[];
};

type WizardForm = z.infer<typeof pickupPayloadSchema>;

const initialValues: WizardForm = {
  carrierPref: "ANY",
  schedule: {
    date: dayjs().format("YYYY-MM-DD"),
    windowStart: "09:00",
    windowEnd: "18:00",
  },
  notes: "",
  shipmentsIds: [],
};

export function PickupWizard({ sender, shipments }: PickupWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<WizardForm>({
    resolver: zodResolver(pickupPayloadSchema) as Resolver<WizardForm>,
    defaultValues: {
      carrierPref: initialValues?.carrierPref ?? "ANY",
      schedule: initialValues?.schedule ?? { date: "", windowStart: "", windowEnd: "" },
      shipmentsIds: initialValues?.shipmentsIds ?? [],
      notes: initialValues?.notes ?? "",
    },
  });

  const shipmentsIds = watch("shipmentsIds");

  const selectedShipments = useMemo(
    () => shipments.filter((shipment) => shipmentsIds.includes(shipment.id)),
    [shipments, shipmentsIds],
  );

  const totals = useMemo(() => {
    const count = selectedShipments.length;
    const weight = selectedShipments.reduce(
      (acc, shipment) => acc + (shipment.pesoKg ?? 1),
      0,
    );
    const volume = selectedShipments.reduce((acc, shipment) => {
      const comprimento = shipment.comprimentoCm ?? 20;
      const largura = shipment.larguraCm ?? 15;
      const altura = shipment.alturaCm ?? 10;
      return acc + comprimento * largura * altura;
    }, 0);
    return { count, weightKg: weight, volumeCm3: volume };
  }, [selectedShipments]);

  const onSubmit = async (values: WizardForm) => {
    const payload = {
      ...values,
      totals,
    };

    const response = await fetch("/api/pickups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      messageApi.error(body?.mensagem ?? "Não foi possível criar a coleta");
      return;
    }

    const created = await response.json();
    messageApi.success("Coleta solicitada com sucesso");
    router.replace(`/coletas/${created.id}`);
  };

  const nextStep = async () => {
    const stepFields: Array<Array<keyof WizardForm | string>> = [
      [],
      ["shipmentsIds"],
      [
        "schedule.date",
        "schedule.windowStart",
        "schedule.windowEnd",
      ],
    ];

    const fields = stepFields[currentStep] as Parameters<typeof trigger>[0];
    const valid = await trigger(fields);
    if (!valid) {
      messageApi.warning("Preencha os campos obrigatórios");
      return;
    }
    setCurrentStep((step) => step + 1);
  };

  const previousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  return (
    <>
      {contextHolder}
      <Steps
        current={currentStep}
        items={[
          { title: "Origem" },
          { title: "Envios" },
          { title: "Agendamento" },
        ]}
        style={{ marginBottom: 24 }}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {currentStep === 0 ? (
          <Card title="Origem" variant="borderless" style={{ marginBottom: 24 }}>
            <Typography.Text strong>
              {getCompanyDisplayName(sender)}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {`${sender.endereco.logradouro}, ${sender.endereco.numero}`}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {`${sender.endereco.bairro} · ${sender.endereco.cidade}/${sender.endereco.uf}`}
            </Typography.Paragraph>
          </Card>
        ) : null}

        {currentStep === 1 ? (
          <Card title="Selecione os envios" variant="borderless" style={{ marginBottom: 24 }}>
            <PickupShipmentsTable
              shipments={shipments}
              selectedRowKeys={watch("shipmentsIds")}
              onSelectionChange={(keys) => setValue("shipmentsIds", keys)}
            />
          </Card>
        ) : null}

        {currentStep === 2 ? (
          <Card title="Agendamento" variant="borderless" style={{ marginBottom: 24 }}>
            <Space orientation="vertical" style={{ width: "100%" }} size={16}>
              <Controller
                name="schedule.date"
                control={control}
                render={({ field }) => (
                  <Form.Item
                    label="Data"
                    required
                    validateStatus={errors.schedule?.date ? "error" : ""}
                    help={errors.schedule?.date?.message}
                  >
                    <DatePicker
                      {...field}
                      value={field.value ? dayjs(field.value) : null}
                      onChange={(date) =>
                        field.onChange(date ? date.format("YYYY-MM-DD") : "")
                      }
                      style={{ width: 200 }}
                    />
                  </Form.Item>
                )}
              />

              <Space>
                <Controller
                  name="schedule.windowStart"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Início"
                      required
                      validateStatus={errors.schedule?.windowStart ? "error" : ""}
                      help={errors.schedule?.windowStart?.message}
                    >
                      <TimePicker
                        {...field}
                        value={field.value ? dayjs(field.value, "HH:mm") : null}
                        onChange={(time) =>
                          field.onChange(time ? time.format("HH:mm") : "")
                        }
                        format="HH:mm"
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  name="schedule.windowEnd"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Fim"
                      required
                      validateStatus={errors.schedule?.windowEnd ? "error" : ""}
                      help={errors.schedule?.windowEnd?.message}
                    >
                      <TimePicker
                        {...field}
                        value={field.value ? dayjs(field.value, "HH:mm") : null}
                        onChange={(time) =>
                          field.onChange(time ? time.format("HH:mm") : "")
                        }
                        format="HH:mm"
                      />
                    </Form.Item>
                  )}
                />
              </Space>

              <Controller
                name="carrierPref"
                control={control}
                render={({ field }) => (
                  <Form.Item label="Transportadora preferencial">
                    <Select {...field} options={carrierOptions} style={{ width: 200 }} />
                  </Form.Item>
                )}
              />

              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <Form.Item label="Observações">
                    <Input.TextArea {...field} rows={3} maxLength={500} />
                  </Form.Item>
                )}
              />
            </Space>
          </Card>
        ) : null}

        <Space>
          {currentStep > 0 ? <Button onClick={previousStep}>Voltar</Button> : null}
          {currentStep < 2 ? (
            <Button type="primary" onClick={nextStep}>
              Próximo
            </Button>
          ) : (
            <Button type="primary" htmlType="submit">
              Confirmar coleta
            </Button>
          )}
        </Space>
      </form>

      <PickupSummary sender={sender} totals={totals} schedule={watch("schedule")} />
    </>
  );
}
