"use client";

import { useEffect } from "react";
import { Form, Flex } from "antd";
import { ELButton, ELDrawer, ELFormItem, ELInput, ELSelect } from '@/shared/ui';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminUserSchema } from "@/modules/auth/application/schemas";
import { useCreateUser, useUpdateUser } from "@/modules/auth/application/hooks";
import type { AdminUser } from "@/modules/auth/application/types";
import { RolesChecklist } from "./RolesChecklist";
import { spacing } from "@/shared/ui/theme";

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
          <ELButton onClick={handleClose}>Cancelar</ELButton>
          <ELButton
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            loading={isSubmitting}
          >
            {isEdit ? "Salvar" : "Criar"}
          </ELButton>
        </Flex>
      }
    >
      <Form layout="vertical">
        <ELFormItem
          label="Nome"
          validateStatus={errors.name ? "error" : undefined}
          help={errors.name?.message}
          required
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <ELInput {...field} placeholder="Nome completo" />
            )}
          />
        </ELFormItem>

        <ELFormItem
          label="E-mail"
          validateStatus={errors.email ? "error" : undefined}
          help={errors.email?.message}
          required
        >
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <ELInput {...field} type="email" placeholder="usuario@empresa.com" />
            )}
          />
        </ELFormItem>

        <ELFormItem
          label="Telefone"
          validateStatus={errors.phone ? "error" : undefined}
          help={errors.phone?.message}
        >
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <ELInput {...field} value={field.value || ""} placeholder="+55 11 98765-4321" />
            )}
          />
        </ELFormItem>

        <ELFormItem
          label="Status"
          validateStatus={errors.status ? "error" : undefined}
          help={errors.status?.message}
          required
        >
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <ELSelect
                {...field}
                options={[
                  { label: "Ativo", value: "active" },
                  { label: "Bloqueado", value: "blocked" },
                ]}
              />
            )}
          />
        </ELFormItem>

        <ELFormItem
          label="Permissões"
          validateStatus={errors.roles ? "error" : undefined}
          help={errors.roles?.message}
          required
        >
          <Controller
            name="roles"
            control={control}
            render={({ field }) => <RolesChecklist {...field} />}
          />
        </ELFormItem>
      </Form>
    </ELDrawer>
  );
}
