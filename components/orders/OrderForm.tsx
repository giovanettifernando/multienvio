"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  message,
} from "antd";
import { orderSchema } from "@/lib/validation/order";
import { normalizeCEPInput } from "@/lib/masks";

type OrderFormValues = z.infer<typeof orderSchema>;

const categoriaOptions = [
  { label: "Eletrônicos", value: "ELETRONICOS" },
  { label: "Roupas", value: "ROUPAS" },
  { label: "Geral", value: "GERAL" },
];

async function lookupCep(cep: string) {
  const response = await fetch(`/api/cep?cep=${cep}`);
  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP");
  }
  return response.json();
}

export function OrderForm() {
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const methods = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema) as Resolver<OrderFormValues>,
    defaultValues: {
      customer: {
        name: "",
        address: {
          cep: "",
          logradouro: "",
          numero: "",
          complemento: "",
          bairro: "",
          cidade: "",
          uf: "",
        },
      },
      package: {
        pesoKg: 1,
        comprimentoCm: 20,
        larguraCm: 15,
        alturaCm: 10,
        declaredValue: 0,
        category: "GERAL",
      },
      preferences: {
        prioridade: 25,
        adicionais: {},
      },
      items: [],
    },
  });

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = methods;

  const itemsArray = useFieldArray({
    control,
    name: "items",
  });

  const onSubmit = async (values: OrderFormValues) => {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      messageApi.error(body?.mensagem ?? "Não foi possível criar o pedido");
      return;
    }

    const created = await response.json();
    messageApi.success("Pedido criado com sucesso");
    router.replace(`/pedidos/${created.id}`);
  };

  return (
    <FormProvider {...methods}>
      {contextHolder}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Flex gap={24} align="start" wrap>
          <Space direction="vertical" size={24} style={{ flex: 1, minWidth: 320 }}>
            <Card title="Cliente e endereço" variant="borderless">
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Controller
                  name="customer.name"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Nome completo"
                      required
                      validateStatus={errors.customer?.name ? "error" : ""}
                      help={errors.customer?.name?.message}
                    >
                      <Input {...field} placeholder="Nome do cliente" />
                    </Form.Item>
                  )}
                />

                <Row gutter={12}>
                  <Col span={12}>
                    <Controller
                      name="customer.email"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="E-mail"
                          validateStatus={errors.customer?.email ? "error" : ""}
                          help={errors.customer?.email?.message}
                        >
                          <Input {...field} placeholder="cliente@email.com" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col span={12}>
                    <Controller
                      name="customer.phone"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Telefone"
                          validateStatus={errors.customer?.phone ? "error" : ""}
                          help={errors.customer?.phone?.message}
                        >
                          <Input {...field} placeholder="(11) 98765-4321" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                </Row>

                <Controller
                  name="customer.doc"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="Documento (CPF/CNPJ)">
                      <Input {...field} placeholder="Opcional" />
                    </Form.Item>
                  )}
                />

                <Controller
                  name="customer.address.cep"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="CEP"
                      required
                      validateStatus={errors.customer?.address?.cep ? "error" : ""}
                      help={errors.customer?.address?.cep?.message}
                    >
                      <Input
                        {...field}
                        value={normalizeCEPInput(field.value)}
                        onChange={async (event) => {
                          const value = normalizeCEPInput(event.target.value);
                          field.onChange(value);
                          if (value.length === 9) {
                            try {
                              const data = await lookupCep(value);
                              if (data.found) {
                                setValue("customer.address.logradouro", data.logradouro);
                                setValue("customer.address.bairro", data.bairro);
                                setValue("customer.address.cidade", data.cidade);
                                setValue("customer.address.uf", data.uf);
                              }
                            } catch {
                              messageApi.warning("Não foi possível consultar o CEP");
                            }
                          }
                        }}
                        placeholder="00000-000"
                      />
                    </Form.Item>
                  )}
                />

                <Controller
                  name="customer.address.logradouro"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="Logradouro"
                      required
                      validateStatus={errors.customer?.address?.logradouro ? "error" : ""}
                      help={errors.customer?.address?.logradouro?.message}
                    >
                      <Input {...field} placeholder="Rua" />
                    </Form.Item>
                  )}
                />

                <Row gutter={12}>
                  <Col span={8}>
                    <Controller
                      name="customer.address.numero"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Número"
                          required
                          validateStatus={errors.customer?.address?.numero ? "error" : ""}
                          help={errors.customer?.address?.numero?.message}
                        >
                          <Input {...field} />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col span={8}>
                    <Controller
                      name="customer.address.complemento"
                      control={control}
                      render={({ field }) => (
                        <Form.Item label="Complemento">
                          <Input {...field} />
                        </Form.Item>
                      )}
                    />
                  </Col>
                </Row>

                <Row gutter={12}>
                  <Col span={12}>
                    <Controller
                      name="customer.address.bairro"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Bairro"
                          required
                          validateStatus={errors.customer?.address?.bairro ? "error" : ""}
                          help={errors.customer?.address?.bairro?.message}
                        >
                          <Input {...field} />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col span={8}>
                    <Controller
                      name="customer.address.cidade"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="Cidade"
                          required
                          validateStatus={errors.customer?.address?.cidade ? "error" : ""}
                          help={errors.customer?.address?.cidade?.message}
                        >
                          <Input {...field} />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col span={4}>
                    <Controller
                      name="customer.address.uf"
                      control={control}
                      render={({ field }) => (
                        <Form.Item
                          label="UF"
                          required
                          validateStatus={errors.customer?.address?.uf ? "error" : ""}
                          help={errors.customer?.address?.uf?.message}
                        >
                          <Input {...field} maxLength={2} />
                        </Form.Item>
                      )}
                    />
                  </Col>
                </Row>
              </Space>
            </Card>

            <Card title="Pacote" variant="borderless">
              <Row gutter={12}>
                <Col span={6}>
                  <Controller
                    name="package.pesoKg"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="Peso (kg)"
                        required
                        validateStatus={errors.package?.pesoKg ? "error" : ""}
                        help={errors.package?.pesoKg?.message}
                      >
                        <InputNumber {...field} min={0.1} step={0.1} style={{ width: "100%" }} />
                      </Form.Item>
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Controller
                    name="package.comprimentoCm"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="Comprimento"
                        required
                        validateStatus={errors.package?.comprimentoCm ? "error" : ""}
                        help={errors.package?.comprimentoCm?.message}
                      >
                        <InputNumber {...field} min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Controller
                    name="package.larguraCm"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="Largura"
                        required
                        validateStatus={errors.package?.larguraCm ? "error" : ""}
                        help={errors.package?.larguraCm?.message}
                      >
                        <InputNumber {...field} min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    )}
                  />
                </Col>
                <Col span={6}>
                  <Controller
                    name="package.alturaCm"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="Altura"
                        required
                        validateStatus={errors.package?.alturaCm ? "error" : ""}
                        help={errors.package?.alturaCm?.message}
                      >
                        <InputNumber {...field} min={1} style={{ width: "100%" }} />
                      </Form.Item>
                    )}
                  />
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Controller
                    name="package.declaredValue"
                    control={control}
                    render={({ field }) => (
                      <Form.Item label="Valor declarado" validateStatus={errors.package?.declaredValue ? "error" : ""} help={errors.package?.declaredValue?.message}>
                        <InputNumber {...field} min={0} step={10} style={{ width: "100%" }} />
                      </Form.Item>
                    )}
                  />
                </Col>
                <Col span={8}>
                  <Controller
                    name="package.category"
                    control={control}
                    render={({ field }) => (
                      <Form.Item label="Categoria">
                        <Select {...field} options={categoriaOptions} />
                      </Form.Item>
                    )}
                  />
                </Col>
              </Row>
            </Card>

            <Card title="Itens" variant="borderless">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {itemsArray.fields.map((item, index) => (
                  <Card key={item.id} size="small">
                    <Row gutter={12}>
                      <Col span={8}>
                        <Controller
                          name={`items.${index}.name` as const}
                          control={control}
                          render={({ field }) => (
                            <Form.Item
                              label="Descrição"
                              required
                              validateStatus={
                                errors.items?.[index]?.name ? "error" : ""
                              }
                              help={errors.items?.[index]?.name?.message}
                            >
                              <Input {...field} placeholder="Nome do produto" />
                            </Form.Item>
                          )}
                        />
                      </Col>
                      <Col span={4}>
                        <Controller
                          name={`items.${index}.sku` as const}
                          control={control}
                          render={({ field }) => (
                            <Form.Item label="SKU">
                              <Input {...field} placeholder="Opcional" />
                            </Form.Item>
                          )}
                        />
                      </Col>
                      <Col span={4}>
                        <Controller
                          name={`items.${index}.qty` as const}
                          control={control}
                          render={({ field }) => (
                            <Form.Item
                              label="Qtd"
                              required
                              validateStatus={
                                errors.items?.[index]?.qty ? "error" : ""
                              }
                              help={errors.items?.[index]?.qty?.message}
                            >
                              <InputNumber {...field} min={1} style={{ width: "100%" }} />
                            </Form.Item>
                          )}
                        />
                      </Col>
                      <Col span={4}>
                        <Controller
                          name={`items.${index}.unitPrice` as const}
                          control={control}
                          render={({ field }) => (
                            <Form.Item label="Valor unitário">
                              <InputNumber {...field} min={0} style={{ width: "100%" }} />
                            </Form.Item>
                          )}
                        />
                      </Col>
                      <Col span={4}>
                        <Button danger onClick={() => itemsArray.remove(index)}>
                          Remover
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => itemsArray.append({ name: "", qty: 1 })}>
                  Adicionar item
                </Button>
              </Space>
            </Card>
          </Space>

          <Card title="Preferências" variant="borderless" style={{ width: 320 }}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Controller
                name="preferences.prioridade"
                control={control}
                render={({ field }) => (
                  <Form.Item label="Prioridade (0-100)">
                    <InputNumber {...field} min={0} max={100} style={{ width: "100%" }} />
                  </Form.Item>
                )}
              />
              <Controller
                name="preferences.carrierFilter"
                control={control}
                render={({ field }) => (
                  <Form.Item label="Transportadoras">
                    <Select
                      {...field}
                      mode="multiple"
                      allowClear
                      options={[
                        { label: "Correios", value: "Correios" },
                        { label: "Jadlog", value: "Jadlog" },
                        { label: "Loggi", value: "Loggi" },
                        { label: "J&T", value: "J&T" },
                      ]}
                      placeholder="Selecionar"
                    />
                  </Form.Item>
                )}
              />
            </Space>
          </Card>
        </Flex>

        <Space style={{ marginTop: 24 }}>
          <Button onClick={() => router.back()}>Cancelar</Button>
          <Button type="primary" htmlType="submit">
            Salvar pedido
          </Button>
        </Space>
      </form>
    </FormProvider>
  );
}
