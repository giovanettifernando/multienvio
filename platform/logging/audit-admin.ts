import { prisma } from '@/platform/db/db';

/**
 * Log de ação administrativa para auditoria
 *
 * @param actorId - ID do staff que realizou a ação
 * @param action - Ação realizada (ex: "login", "create_staff", "update_role")
 * @param entity - Entidade afetada (ex: "StaffUser", "User", "Shipment")
 * @param entityId - ID da entidade afetada (opcional)
 * @param data - Dados adicionais da ação (opcional)
 */
export async function logAdminAction(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.staffAuditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId || null,
        data: data ? JSON.parse(JSON.stringify(data)) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Não lançar erro para não interromper o fluxo principal
  }
}

/**
 * Log de login bem-sucedido
 */
export async function logAdminLogin(staffId: string, email: string, ip?: string): Promise<void> {
  await logAdminAction(
    staffId,
    'login',
    'StaffUser',
    staffId,
    { email, ip, timestamp: new Date().toISOString() }
  );
}

/**
 * Log de criação de novo staff
 */
export async function logStaffCreation(
  actorId: string,
  newStaffId: string,
  newStaffEmail: string
): Promise<void> {
  await logAdminAction(
    actorId,
    'create_staff',
    'StaffUser',
    newStaffId,
    { email: newStaffEmail }
  );
}

/**
 * Log de alteração de role
 */
export async function logRoleChange(
  actorId: string,
  targetStaffId: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await logAdminAction(
    actorId,
    'update_role',
    'StaffUser',
    targetStaffId,
    { oldRole, newRole }
  );
}

/**
 * Log de alteração de status
 */
export async function logStatusChange(
  actorId: string,
  targetStaffId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  await logAdminAction(
    actorId,
    'update_status',
    'StaffUser',
    targetStaffId,
    { oldStatus, newStatus }
  );
}

/**
 * Log de reset de senha
 */
export async function logPasswordReset(
  actorId: string,
  targetUserId: string,
  entityType: 'StaffUser' | 'User' | 'Collector'
): Promise<void> {
  await logAdminAction(
    actorId,
    'reset_password',
    entityType,
    targetUserId,
    { timestamp: new Date().toISOString() }
  );
}

/**
 * Log de operação financeira
 */
export async function logFinanceOperation(
  actorId: string,
  operation: string,
  entityType: string,
  entityId: string,
  amount?: number,
  additionalData?: Record<string, unknown>
): Promise<void> {
  await logAdminAction(
    actorId,
    `finance_${operation}`,
    entityType,
    entityId,
    { amount, ...additionalData }
  );
}

/**
 * Log de aprovação de comissão
 */
export async function logCommissionApproval(
  actorId: string,
  commissionId: string,
  amount: number
): Promise<void> {
  await logFinanceOperation(
    actorId,
    'approve_commission',
    'Commission',
    commissionId,
    amount
  );
}

/**
 * Log de pagamento aprovado
 */
export async function logPayoutApproval(
  actorId: string,
  payoutId: string,
  amount: number,
  recipientId: string
): Promise<void> {
  await logFinanceOperation(
    actorId,
    'approve_payout',
    'Payout',
    payoutId,
    amount,
    { recipientId }
  );
}

/**
 * Log de ajuste manual no ledger
 */
export async function logLedgerAdjustment(
  actorId: string,
  userId: string,
  amount: number,
  reason: string
): Promise<void> {
  await logFinanceOperation(
    actorId,
    'ledger_adjustment',
    'Ledger',
    userId,
    amount,
    { reason }
  );
}

/**
 * Log de bloqueio/desbloqueio de cliente
 */
export async function logClientStatusChange(
  actorId: string,
  clientId: string,
  action: 'block' | 'unblock',
  reason?: string
): Promise<void> {
  await logAdminAction(
    actorId,
    `client_${action}`,
    'User',
    clientId,
    { reason }
  );
}

/**
 * Log de alteração de permissões
 */
export async function logPermissionChange(
  actorId: string,
  targetStaffId: string,
  addedPermissions: string[],
  removedPermissions: string[]
): Promise<void> {
  await logAdminAction(
    actorId,
    'update_permissions',
    'StaffUser',
    targetStaffId,
    { addedPermissions, removedPermissions }
  );
}
