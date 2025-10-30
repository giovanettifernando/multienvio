import { prisma } from '@/lib/db';

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
