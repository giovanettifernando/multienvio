/**
 * Hook para gerenciar dados da conta do usuário
 * Integra com os endpoints GET/PUT /api/account/me
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useELApp } from '@/shared/ui';
const App = { useApp: useELApp };
import { useEffect } from 'react';

export interface AccountData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  cpf?: string | null;
  avatarUrl?: string | null;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAccountInput {
  name: string;
  phone?: string | null;
  cpf?: string | null;
  avatarUrl?: string | null;
}

interface AccountResponse {
  success: boolean;
  user: AccountData;
}

interface UpdateAccountResponse {
  success: boolean;
  message: string;
  user: AccountData;
}

interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: Array<{ field: string; message: string }>;
}

/**
 * Busca os dados da conta do usuário autenticado
 */
async function fetchAccount(): Promise<AccountData> {
  const response = await fetch('/api/account/me', {
    credentials: 'include',
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const data: AccountResponse | ErrorResponse = await response.json();

  if (!data.success) {
    throw new Error((data as ErrorResponse).code || 'FETCH_FAILED');
  }

  return (data as AccountResponse).user;
}

/**
 * Atualiza os dados da conta do usuário autenticado
 */
async function updateAccount(input: UpdateAccountInput): Promise<AccountData> {
  const response = await fetch('/api/account/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (response.status === 429) {
    throw new Error('RATE_LIMIT_EXCEEDED');
  }

  const data: UpdateAccountResponse | ErrorResponse = await response.json();

  if (!data.success) {
    const errorData = data as ErrorResponse;
    // Criar erro com informações detalhadas
    const error = new Error(errorData.message) as Error & { code?: string; errors?: Array<{ field: string; message: string }> };
    error.code = errorData.code;
    error.errors = errorData.errors;
    throw error;
  }

  return (data as UpdateAccountResponse).user;
}

/**
 * Hook principal para gerenciar dados da conta
 */
export function useAccount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { message } = App.useApp();

  // Query para buscar dados
  const {
    data: account,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['account', 'me'],
    queryFn: fetchAccount,
    retry: false,
  });

  // Tratar erros do useQuery
  useEffect(() => {
    if (error) {
      if (error.message === 'UNAUTHORIZED') {
        message.error('Sessão expirada. Faça login novamente.');
        router.push('/auth/login');
      } else {
        message.error('Erro ao carregar dados da conta');
      }
    }
  }, [error, message, router]);

  // Mutation para atualizar dados
  const updateMutation = useMutation({
    mutationFn: updateAccount,
    onSuccess: (updatedUser) => {
      // Atualizar cache local
      queryClient.setQueryData(['account', 'me'], updatedUser);

      message.success('Dados atualizados com sucesso!');
    },
    onError: (err: Error & { code?: string; errors?: Array<{ field: string; message: string }> }) => {
      console.error('[useAccount] Update error:', err);

      // Tratar erros específicos
      if (err.message === 'UNAUTHORIZED') {
        message.error('Sessão expirada. Faça login novamente.');
        router.push('/auth/login');
        return;
      }

      if (err.message === 'RATE_LIMIT_EXCEEDED') {
        message.warning('Muitas tentativas. Aguarde um momento e tente novamente.');
        return;
      }

      // Mapear códigos de erro para mensagens amigáveis
      const errorMessages: Record<string, string> = {
        INVALID_NAME: 'Nome inválido (deve ter entre 3 e 120 caracteres)',
        INVALID_PHONE: 'Telefone inválido',
        INVALID_CPF: 'CPF inválido',
        EMAIL_IMMUTABLE: 'Email não pode ser alterado',
        VALIDATION_ERROR: 'Dados inválidos. Verifique os campos.',
      };

      const errorMessage = err.code ? errorMessages[err.code] || err.message : err.message;
      message.error(errorMessage);
    },
  });

  return {
    account,
    isLoading,
    error,
    refetch,
    updateAccount: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}
