import { PrismaClient, AdminPermission } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ALL_PERMISSIONS = Object.values(AdminPermission);

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  // 1. Atualiza senha do User (cliente)
  const user = await prisma.user.updateMany({
    where: { email: 'admin@enviolegal.com' },
    data: { passwordHash },
  });
  console.log(`✅ User atualizado: ${user.count} registro(s)`);

  // 2. Garante que existe uma StaffRole admin
  let adminRole = await prisma.staffRole.findFirst({ where: { name: 'admin' } });
  if (!adminRole) {
    adminRole = await prisma.staffRole.create({ data: { name: 'admin' } });
    console.log('✅ StaffRole admin criada');
  }

  // 3. Cria ou atualiza o StaffUser para admin@enviolegal.com
  const existing = await prisma.staffUser.findUnique({ where: { email: 'admin@enviolegal.com' } });
  if (existing) {
    await prisma.staffUser.update({
      where: { email: 'admin@enviolegal.com' },
      data: { passwordHash, permissions: ALL_PERMISSIONS, status: 'ACTIVE', roleId: adminRole.id },
    });
    console.log('✅ StaffUser atualizado com todas as permissões');
  } else {
    await prisma.staffUser.create({
      data: {
        name: 'Administrador',
        email: 'admin@enviolegal.com',
        passwordHash,
        status: 'ACTIVE',
        roleId: adminRole.id,
        permissions: ALL_PERMISSIONS,
      },
    });
    console.log('✅ StaffUser criado com todas as permissões');
  }

  console.log('\n📋 Credenciais:');
  console.log('   admin@enviolegal.com / admin123');
  console.log('   Permissões:', ALL_PERMISSIONS.join(', '));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
