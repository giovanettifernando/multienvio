"use client";

import { useEffect } from "react";
import { Form, Input, Select, Button, Flex } from "antd";
import { ELDrawer } from "@/components/ui/ELDrawer";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminUserSchema } from "@/lib/auth/schemas";
import { useCreateUser, useUpdateUser } from "@/lib/auth/hooks";
import type { AdminUser } from "@/lib/auth/types";
import { RolesChecklist } from "./RolesChecklist";
import { spacing } from "@/lib/ui/theme";

type UserFormData = {
  name: string;
  email: string;
  phone?: string | null;
  status: "active" | "blocked";
  roles: string[];
};

interface UserDrawerProps {
  open: boolean;
  user?: AdminUser | null;
  onClose: () => void;
}

export function UserDrawer({ open, user, onClose }: UserDrawerProps) {
  const isEdit = !!user;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: null,
      status: "active",
      roles: [],
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status,
        roles: user.roles,
      });
    } else {
      reset({
        name: "",
        email: "",
        phone: null,
        status: "active",
        roles: [],
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UserFormData) => {
    try {
      if (isEdit && user) {
        await updateMutation.mutateAsync({
          id: user.id,
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            status: data.status,
            roles: data.roles,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          status: data.status,
          roles: data.roles,
        });
      }
      handleClose();
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <ELDrawer
      title={isEdit ? "Editar Usuário" : "Adicionar Usuário"}
      open={open}
      onClose={handleClose}
      drawerSize="lg"
      footer={
        <Flex justify="flex-end" gap={spacing.md}>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button
            type="primary"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
          >
            {isEdit ? "Salvar" : "Criar"}
          </Button>
        </Flex>
      }
    >
      <Form layout="vertical">
        <Form.Item
          label="Nome"
          validateStatus={errors.name ? "error" : ""}
          help={errors.name?.message}
          required
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="Nome completo" />
            )}
          />
        </Form.Item>

        <Form.Item
          label="E-mail"
          validateStatus={errors.email ? "error" : ""}
          help={errors.email?.message}
          required
        >
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input {...field} type="email" placeholder="usuario@enviolegal.com" />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Telefone"
          validateStatus={errors.phone ? "error" : ""}
          help={errors.phone?.message}
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input {...field} value={field.value || ""} placeholder="+55 11 98765-4321" />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Status"
          validateStatus={errors.status ? "error" : ""}
          help={errors.status?.message}
          required
        >
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                options={[
                  { label: "Ativo", value: "active" },
                  { label: "Bloqueado", value: "blocked" },
                ]}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="Permissões"
          validateStatus={errors.roles ? "error" : ""}
          help={errors.roles?.message}
          required
        >
          <Controller
            name="roles"
            control={control}
            render={({ field }) => <RolesChecklist {...field} />}
          />
        </Form.Item>
      </Form>
    </ELDrawer>
  );
}
