import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import type {
  Carrier,
  CarrierApi,
  AuthConfig,
  PaymentGatewayConfig,
  IntegrationHealth,
  CarrierFormData,
  ApiFormData,
  AuthFormData,
  PaymentGatewayFormData,
} from './types';
import { integrationKeys } from './queryKeys';

// ========== CARRIERS ==========

export function useCarriers() {
  return useQuery({
    queryKey: integrationKeys.carriers(),
    queryFn: async (): Promise<Carrier[]> => {
      const res = await fetch('/api/admin/integrations/carriers');
      if (!res.ok) throw new Error('Erro ao carregar transportadoras');
      const data = await res.json();
      return data.carriers || [];
    },
  });
}

export function useCarrier(id: string | null) {
  return useQuery({
    queryKey: integrationKeys.carrier(id || ''),
    queryFn: async (): Promise<Carrier> => {
      const res = await fetch(`/api/admin/integrations/carriers/${id}`);
      if (!res.ok) throw new Error('Erro ao carregar transportadora');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CarrierFormData): Promise<Carrier> => {
      const res = await fetch('/api/admin/integrations/carriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao criar transportadora');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.carriers() });
      message.success('Transportadora criada com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useUpdateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CarrierFormData> }): Promise<Carrier> => {
      const res = await fetch(`/api/admin/integrations/carriers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao atualizar transportadora');
      }
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: integrationKeys.carrier(id) });
      const previous = queryClient.getQueryData(integrationKeys.carrier(id));

      queryClient.setQueryData(integrationKeys.carrier(id), (old: Carrier | undefined) => {
        if (!old) return old;
        return { ...old, ...data, updatedAt: new Date().toISOString() };
      });

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.carriers() });
      message.success('Transportadora atualizada com sucesso');
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(integrationKeys.carrier(_variables.id), context.previous);
      }
      message.error(error.message);
    },
  });
}

export function useDeleteCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/admin/integrations/carriers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir transportadora');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.carriers() });
      message.success('Transportadora excluída com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

// ========== APIS ==========

export function useApis(carrierId?: string) {
  return useQuery({
    queryKey: integrationKeys.apis(carrierId),
    queryFn: async (): Promise<CarrierApi[]> => {
      const url = carrierId
        ? `/api/integrations/apis?carrierId=${carrierId}`
        : '/api/integrations/apis';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar APIs');
      return res.json();
    },
  });
}

export function useCreateApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ApiFormData): Promise<CarrierApi> => {
      const res = await fetch('/api/integrations/apis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao criar API');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.apis(variables.carrierId) });
      queryClient.invalidateQueries({ queryKey: integrationKeys.apis() });
      message.success('API criada com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useUpdateApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ApiFormData> }): Promise<CarrierApi> => {
      const res = await fetch(`/api/integrations/apis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao atualizar API');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.apis() });
      message.success('API atualizada com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useDeleteApi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/integrations/apis/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erro ao excluir API');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.apis() });
      message.success('API excluída com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

// ========== AUTH ==========

export function useAuth(carrierId: string | null) {
  return useQuery({
    queryKey: integrationKeys.auth(carrierId || ''),
    queryFn: async (): Promise<AuthConfig | null> => {
      const res = await fetch(`/api/integrations/auth/${carrierId}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Erro ao carregar autenticação');
      return res.json();
    },
    enabled: !!carrierId,
  });
}

export function useSaveAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AuthFormData): Promise<AuthConfig> => {
      const res = await fetch(`/api/integrations/auth/${data.carrierId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao salvar autenticação');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.auth(variables.carrierId) });
      message.success('Autenticação salva com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useRotateSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ carrierId, fieldKey }: { carrierId: string; fieldKey: string }): Promise<AuthConfig> => {
      const res = await fetch(`/api/integrations/auth/${carrierId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldKey }),
      });
      if (!res.ok) throw new Error('Erro ao rotacionar credencial');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.auth(variables.carrierId) });
      message.success('Credencial rotacionada com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

// ========== PAYMENT GATEWAY ==========

export function usePaymentGateway() {
  return useQuery({
    queryKey: integrationKeys.paymentGateway(),
    queryFn: async (): Promise<PaymentGatewayConfig> => {
      const res = await fetch('/api/integrations/payment-gateway');
      if (!res.ok) throw new Error('Erro ao carregar gateway de pagamento');
      return res.json();
    },
  });
}

export function useSavePaymentGateway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PaymentGatewayFormData): Promise<PaymentGatewayConfig> => {
      const res = await fetch('/api/integrations/payment-gateway', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erro ao salvar gateway de pagamento');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.paymentGateway() });
      message.success('Gateway de pagamento salvo com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

export function useTestPaymentWebhook() {
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      const res = await fetch('/api/integrations/payment-gateway/test-webhook', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro ao testar webhook');
      return res.json();
    },
    onSuccess: (data) => {
      message.success(data.message || 'Webhook testado com sucesso');
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}

// ========== HEALTH ==========

export function useHealth() {
  return useQuery({
    queryKey: integrationKeys.health(),
    queryFn: async (): Promise<IntegrationHealth[]> => {
      const res = await fetch('/api/integrations/health');
      if (!res.ok) throw new Error('Erro ao carregar status das integrações');
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30s
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (carrierId: string): Promise<IntegrationHealth> => {
      const res = await fetch(`/api/integrations/health/${carrierId}/test`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro ao testar conexão');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.health() });
      if (data.status === 'up') {
        message.success('Conexão estabelecida com sucesso');
      } else {
        message.warning(data.message || 'Falha na conexão');
      }
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });
}
