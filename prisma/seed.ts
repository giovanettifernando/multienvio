import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (opcional - cuidado em produção!)
  console.log('🧹 Limpando dados existentes...');
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  // Role table está @deprecated - não limpar para evitar problemas em produção

  // Limpar staff tables
  await prisma.staffAuditLog.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.staffRole.deleteMany();

  // Hash da senha do admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // Criar usuário admin (já verificado)
  // Nota: roleId está @deprecated - não associar roles em User
  console.log('🔐 Criando usuário administrador...');
  const adminUser = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@enviolegal.com',
      passwordHash: adminPasswordHash,
      phone: '(11) 99999-9999',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      lastLoginAt: null,
    },
  });

  console.log(`✅ Usuário admin criado: ${adminUser.email}`);

  // Criar usuário de teste comum (já verificado)
  console.log('👤 Criando usuário de teste...');
  const testUserPasswordHash = await bcrypt.hash('user123', 10);

  const testUser = await prisma.user.create({
    data: {
      name: 'Usuário Teste',
      email: 'user@enviolegal.com',
      passwordHash: testUserPasswordHash,
      phone: '(11) 88888-8888',
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      lastLoginAt: null,
    },
  });

  console.log(`✅ Usuário teste criado: ${testUser.email}`);

  // Criar endereços de exemplo
  console.log('📍 Criando endereços de exemplo...');
  await prisma.address.create({
    data: {
      cep: '01310100',
      logradouro: 'Avenida Paulista',
      numero: '1578',
      complemento: 'Andar 5',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
      userId: adminUser.id,
    },
  });

  await prisma.address.create({
    data: {
      cep: '20040020',
      logradouro: 'Avenida Rio Branco',
      numero: '156',
      complemento: null,
      bairro: 'Centro',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      userId: testUser.id,
    },
  });

  console.log('✅ Endereços criados');

  // ============================================================================
  // STAFF AUTHENTICATION (Painel Administrativo)
  // ============================================================================

  console.log('\n👔 Criando roles de staff...');
  const staffAdminRole = await prisma.staffRole.create({
    data: {
      name: 'admin',
    },
  });

  const staffOperatorRole = await prisma.staffRole.create({
    data: {
      name: 'operator',
    },
  });

  console.log(`✅ Staff roles criadas: ${staffAdminRole.name}, ${staffOperatorRole.name}`);

  // Hash da senha do staff admin
  const staffAdminPasswordHash = await bcrypt.hash('admin123', 10);

  // Criar staff admin
  console.log('🔐 Criando staff administrador...');
  const staffAdmin = await prisma.staffUser.create({
    data: {
      name: 'Staff Administrador',
      email: 'staff@enviolegal.com',
      passwordHash: staffAdminPasswordHash,
      status: 'ACTIVE',
      roleId: staffAdminRole.id,
      lastLoginAt: null,
    },
  });

  console.log(`✅ Staff admin criado: ${staffAdmin.email}`);

  // Criar staff operator
  console.log('👨‍💼 Criando staff operator...');
  const staffOperatorPasswordHash = await bcrypt.hash('operator123', 10);

  const staffOperator = await prisma.staffUser.create({
    data: {
      name: 'Staff Operator',
      email: 'operator@enviolegal.com',
      passwordHash: staffOperatorPasswordHash,
      status: 'ACTIVE',
      roleId: staffOperatorRole.id,
      lastLoginAt: null,
    },
  });

  console.log(`✅ Staff operator criado: ${staffOperator.email}`);

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Credenciais de Clientes:');
  console.log('   Admin: admin@enviolegal.com / admin123');
  console.log('   User:  user@enviolegal.com / user123');
  console.log('\n📋 Credenciais de Staff (Painel /admin):');
  console.log('   Staff Admin:    staff@enviolegal.com / admin123');
  console.log('   Staff Operator: operator@enviolegal.com / operator123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro durante o seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
