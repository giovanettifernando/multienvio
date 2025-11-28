// Tipos de despesas
export type ExpenseType = 'FIXED' | 'VARIABLE';
export type ExpenseCategory =
  | 'INFRAESTRUTURA'
  | 'SOFTWARE'
  | 'GATEWAY'
  | 'MARKETING'
  | 'PESSOAL'
  | 'ADMINISTRATIVO'
  | 'LOGISTICA'
  | 'IMPOSTOS'
  | 'OUTROS';
export type ExpenseStatus = 'PENDING' | 'PAID' | 'CANCELED';

export interface Expense {
  id: string;
  type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  amountReais: number;
  status: ExpenseStatus;
  dueDate: string | null;
  paidAt: string | null;
  reference: string | null;
  supplier: string | null;
  notes: string | null;
  dreAccountCode: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  receiptUploadedAt: string | null;
  isRecurring: boolean;
  recurringMonths: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListParams {
  page?: number;
  pageSize?: number;
  dateStart?: string;
  dateEnd?: string;
  type?: ExpenseType;
  category?: ExpenseCategory;
  status?: ExpenseStatus;
  q?: string;
}

export interface ExpenseSummary {
  totalAmountCents: number;
  totalAmountReais: number;
  totalCount: number;
  byStatus: Record<
    string,
    { count: number; amountCents: number; amountReais: number }
  >;
}

export interface ExpenseListResponse {
  items: Expense[];
  page: number;
  pageSize: number;
  total: number;
  summary: ExpenseSummary;
}

export interface CreateExpenseData {
  type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  amountCents: number;
  status?: ExpenseStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  reference?: string | null;
  supplier?: string | null;
  notes?: string | null;
  dreAccountCode?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  receipt?: File | null;
}

export interface UpdateExpenseData {
  type?: ExpenseType;
  category?: ExpenseCategory;
  description?: string;
  amountCents?: number;
  status?: ExpenseStatus;
  dueDate?: string | null;
  paidAt?: string | null;
  reference?: string | null;
  supplier?: string | null;
  notes?: string | null;
  dreAccountCode?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  receipt?: File | null;
  removeReceipt?: boolean;
}

// Labels para exibição
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  FIXED: 'Fixa',
  VARIABLE: 'Variável',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  INFRAESTRUTURA: 'Infraestrutura',
  SOFTWARE: 'Software',
  GATEWAY: 'Gateway de Pagamento',
  MARKETING: 'Marketing',
  PESSOAL: 'Pessoal',
  ADMINISTRATIVO: 'Administrativo',
  LOGISTICA: 'Logística',
  IMPOSTOS: 'Impostos',
  OUTROS: 'Outros',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  CANCELED: 'Cancelado',
};

// API functions
export async function listExpenses(
  params: ExpenseListParams
): Promise<ExpenseListResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params.dateStart) searchParams.set('dateStart', params.dateStart);
  if (params.dateEnd) searchParams.set('dateEnd', params.dateEnd);
  if (params.type) searchParams.set('type', params.type);
  if (params.category) searchParams.set('category', params.category);
  if (params.status) searchParams.set('status', params.status);
  if (params.q) searchParams.set('q', params.q);

  const res = await fetch(`/api/admin/finance/expenses?${searchParams}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao listar despesas');
  return res.json();
}

export async function getExpense(id: string): Promise<Expense> {
  const res = await fetch(`/api/admin/finance/expenses/${id}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao buscar despesa');
  return res.json();
}

export async function createExpense(
  data: CreateExpenseData
): Promise<{ ok: true; expense: Expense }> {
  const formData = new FormData();
  formData.append('type', data.type);
  formData.append('category', data.category);
  formData.append('description', data.description);
  formData.append('amountCents', data.amountCents.toString());
  if (data.status) formData.append('status', data.status);
  if (data.dueDate) formData.append('dueDate', data.dueDate);
  if (data.paidAt) formData.append('paidAt', data.paidAt);
  if (data.reference) formData.append('reference', data.reference);
  if (data.supplier) formData.append('supplier', data.supplier);
  if (data.notes) formData.append('notes', data.notes);
  if (data.dreAccountCode) formData.append('dreAccountCode', data.dreAccountCode);
  if (data.isRecurring !== undefined)
    formData.append('isRecurring', data.isRecurring.toString());
  if (data.recurringMonths !== undefined && data.recurringMonths !== null)
    formData.append('recurringMonths', data.recurringMonths.toString());
  if (data.receipt) formData.append('receipt', data.receipt);

  const res = await fetch('/api/admin/finance/expenses', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Erro ao criar despesa');
  }
  return res.json();
}

export async function updateExpense(
  id: string,
  data: UpdateExpenseData
): Promise<{ ok: true; expense: Expense }> {
  const formData = new FormData();
  if (data.type) formData.append('type', data.type);
  if (data.category) formData.append('category', data.category);
  if (data.description) formData.append('description', data.description);
  if (data.amountCents !== undefined)
    formData.append('amountCents', data.amountCents.toString());
  if (data.status) formData.append('status', data.status);
  if (data.dueDate !== undefined)
    formData.append('dueDate', data.dueDate || '');
  if (data.paidAt !== undefined) formData.append('paidAt', data.paidAt || '');
  if (data.reference !== undefined)
    formData.append('reference', data.reference || '');
  if (data.supplier !== undefined)
    formData.append('supplier', data.supplier || '');
  if (data.notes !== undefined) formData.append('notes', data.notes || '');
  if (data.dreAccountCode !== undefined)
    formData.append('dreAccountCode', data.dreAccountCode || '');
  if (data.isRecurring !== undefined)
    formData.append('isRecurring', data.isRecurring.toString());
  if (data.recurringMonths !== undefined)
    formData.append(
      'recurringMonths',
      data.recurringMonths !== null ? data.recurringMonths.toString() : ''
    );
  if (data.receipt) formData.append('receipt', data.receipt);
  if (data.removeReceipt) formData.append('removeReceipt', 'true');

  const res = await fetch(`/api/admin/finance/expenses/${id}`, {
    method: 'PUT',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Erro ao atualizar despesa');
  }
  return res.json();
}

export async function deleteExpense(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/expenses/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao remover despesa');
  return res.json();
}

export async function markExpensePaid(
  id: string
): Promise<{ ok: true; expense: Expense }> {
  return updateExpense(id, { status: 'PAID' });
}

// ========================================
// Templates de despesas
// ========================================

export interface ExpenseTemplate {
  id: string;
  name: string;
  type: ExpenseType;
  category: ExpenseCategory;
  supplier: string | null;
  defaultAmount: number | null;
  defaultAmountReais: number | null;
  isActive: boolean;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseTemplateData {
  name: string;
  type: ExpenseType;
  category: ExpenseCategory;
  supplier?: string | null;
  defaultAmountCents?: number | null;
}

export async function listExpenseTemplates(
  category?: ExpenseCategory
): Promise<{ items: ExpenseTemplate[] }> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);

  const res = await fetch(`/api/admin/finance/expense-templates?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao listar templates');
  return res.json();
}

export async function createExpenseTemplate(
  data: CreateExpenseTemplateData
): Promise<{ ok: true; template: ExpenseTemplate }> {
  const res = await fetch('/api/admin/finance/expense-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Erro ao criar template');
  }
  return res.json();
}

export async function incrementTemplateUsage(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/expense-templates/${id}`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao registrar uso');
  return res.json();
}

export async function deleteExpenseTemplate(id: string): Promise<{ ok: true }> {
  const res = await fetch(`/api/admin/finance/expense-templates/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao remover template');
  return res.json();
}
