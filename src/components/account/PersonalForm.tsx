"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Form, Input, Row, Space, Switch } from "antd";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProfile, useProfileSave } from "@/hooks/useAccount";
import type { Profile } from "@/types/account";

const pfSchema = z.object({
  nome: z.string().min(3, "Informe seu nome."),
  email: z.string().email("Email inválido."),
  telefone: z.string().min(8, "Telefone inválido."),
  cpf: z.string().min(11, "CPF inválido."),
  // aceitar "" e transformar em undefined
  nascimento: z.string().optional().or(z.literal("").transform(() => undefined)),
});

// PJ é OPCIONAL; todos os campos opcionais.
// cnpj aceita "" e vira undefined para compatibilizar com o form.
const pjSchema = z
  .object({
    cnpj: z
      .string()
      .min(14, "CNPJ inválido.")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    razaoSocial: z.string().optional(),
    nomeFantasia: z.string().optional(),
    ie: z.string().optional(),
  })
  .partial();

const profileSchema = z.object({
  pf: pfSchema,
  pj: pjSchema.optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export default function PersonalForm() {
  const { message } = App.useApp();
  const profileQuery = useProfile();
  const saveMutation = useProfileSave();
  const [includePJ, setIncludePJ] = useState(false);

  const defaultValues = useMemo<ProfileFormValues>(
    () => ({
      pf: {
        nome: profileQuery.data?.pf.nome ?? "",
        email: profileQuery.data?.pf.email ?? "",
        telefone: profileQuery.data?.pf.telefone ?? "",
        cpf: profileQuery.data?.pf.cpf ?? "",
        nascimento: profileQuery.data?.pf.nascimento ?? undefined,
      },
      pj: profileQuery.data?.pj
        ? {
            cnpj: profileQuery.data.pj.cnpj ?? undefined,
            razaoSocial: profileQuery.data.pj.razaoSocial ?? undefined,
            nomeFantasia: profileQuery.data.pj.nomeFantasia ?? undefined,
            ie: profileQuery.data.pj.ie ?? undefined,
          }
        : undefined,
    }),
    [profileQuery.data],
  );

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues>,
    values: defaultValues,
  });

  useEffect(() => {
    setIncludePJ(Boolean(profileQuery.data?.pj));
  }, [profileQuery.data?.pj]);

  const handleSubmit = form.handleSubmit((values) => {
    const payload: Profile = {
      pf: {
        ...values.pf,
        nascimento: values.pf.nascimento ?? null,
      },
      pj: includePJ ? values.pj : undefined,
    };
    saveMutation.mutate(payload, {
      onSuccess: () => {
        message.success("Dados atualizados com sucesso.");
      },
      onError: (error) => {
        message.error(
          error instanceof Error ? error.message : "Falha ao salvar dados.",
        );
      },
    });
  });

  const isLoading = profileQuery.isLoading;

  return (
    <Card title="Dados pessoais" loading={isLoading}>
      <form onSubmit={handleSubmit}>
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <section>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Controller
                  name="pf.nome"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Nome completo"
                      required
                      validateStatus={fieldState.error ? "error" : ""}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="Seu nome" />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={12}>
                <Controller
                  name="pf.email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Email"
                      required
                      validateStatus={fieldState.error ? "error" : ""}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} type="email" placeholder="email@dominio.com" />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={8}>
                <Controller
                  name="pf.telefone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Telefone"
                      required
                      validateStatus={fieldState.error ? "error" : ""}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="(00) 00000-0000" />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={8}>
                <Controller
                  name="pf.cpf"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="CPF"
                      required
                      validateStatus={fieldState.error ? "error" : ""}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} placeholder="000.000.000-00" />
                    </Form.Item>
                  )}
                />
              </Col>
              <Col xs={24} md={8}>
                <Controller
                  name="pf.nascimento"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="Data de nascimento"
                      validateStatus={fieldState.error ? "error" : ""}
                      help={fieldState.error?.message}
                    >
                      <Input {...field} type="date" />
                    </Form.Item>
                  )}
                />
              </Col>
            </Row>
          </section>

          <section>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space align="center" size={12}>
                <Switch checked={includePJ} onChange={setIncludePJ} />
                <span>Adicionar dados de empresa</span>
              </Space>
              {includePJ ? (
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <Controller
                      name="pj.cnpj"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Form.Item
                          label="CNPJ"
                          validateStatus={fieldState.error ? "error" : ""}
                          help={fieldState.error?.message}
                        >
                          <Input {...field} placeholder="00.000.000/0000-00" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col xs={24} md={12}>
                    <Controller
                      name="pj.razaoSocial"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Form.Item
                          label="Razão Social"
                          validateStatus={fieldState.error ? "error" : ""}
                          help={fieldState.error?.message}
                        >
                          <Input {...field} placeholder="Razão Social" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col xs={24} md={12}>
                    <Controller
                      name="pj.nomeFantasia"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Form.Item
                          label="Nome Fantasia"
                          validateStatus={fieldState.error ? "error" : ""}
                          help={fieldState.error?.message}
                        >
                          <Input {...field} placeholder="Nome Fantasia" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                  <Col xs={24} md={12}>
                    <Controller
                      name="pj.ie"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <Form.Item
                          label="Inscrição Estadual"
                          validateStatus={fieldState.error ? "error" : ""}
                          help={fieldState.error?.message}
                        >
                          <Input {...field} placeholder="Inscrição Estadual" />
                        </Form.Item>
                      )}
                    />
                  </Col>
                </Row>
              ) : null}
            </Space>
          </section>

          <div>
            <Button
              type="primary"
              htmlType="submit"
              loading={saveMutation.isPending}
              disabled={saveMutation.isPending}
            >
              Salvar
            </Button>
          </div>
        </Space>
      </form>
    </Card>
  );
}
