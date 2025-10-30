import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Limpar dados existentes (opcional - cuidado em produção!)
  console.log('🧹 Limpando dados existentes...');
  await prisma.trackingEvent.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  // Limpar staff tables
  await prisma.staffAuditLog.deleteMany();
  await prisma.staffUser.deleteMany();
  await prisma.staffRole.deleteMany();

  // Criar roles
  console.log('👥 Criando roles...');
  const adminRole = await prisma.role.create({
    data: {
      name: 'admin',
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'user',
    },
  });

  console.log(`✅ Roles criadas: ${adminRole.name}, ${userRole.name}`);

  // Hash da senha do admin
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // Criar usuário admin
  console.log('🔐 Criando usuário administrador...');
  const adminUser = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@enviolegal.com',
      passwordHash: adminPasswordHash,
      phone: '(11) 99999-9999',
      status: 'active',
      roleId: adminRole.id,
      lastLoginAt: null,
    },
  });

  console.log(`✅ Usuário admin criado: ${adminUser.email}`);

  // Criar usuário de teste comum
  console.log('👤 Criando usuário de teste...');
  const testUserPasswordHash = await bcrypt.hash('user123', 10);

  const testUser = await prisma.user.create({
    data: {
      name: 'Usuário Teste',
      email: 'user@enviolegal.com',
      passwordHash: testUserPasswordHash,
      phone: '(11) 88888-8888',
      status: 'active',
      roleId: userRole.id,
      lastLoginAt: null,
    },
  });

  console.log(`✅ Usuário teste criado: ${testUser.email}`);

  // Criar endereços de exemplo
  console.log('📍 Criando endereços de exemplo...');
  await prisma.address.create({
    data: {
      cep: '01310-100',
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
      cep: '20040-020',
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
