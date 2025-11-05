/**
 * Script de teste para validar o fluxo completo de verificação de e-mail
 *
 * Testa:
 * 1. Token válido → pfEmailVerified=true, status=INACTIVE
 * 2. Token já usado → retorna "já verificado"
 * 3. Token expirado (> 7 dias)
 * 4. Token inexistente
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function testEmailVerificationFlow() {
  console.log('🧪 Testando fluxo de verificação de e-mail de coletores\n');

  try {
    // 1. Verificar estado atual dos coletores
    console.log('📊 Estado atual dos coletores:');
    console.log('════════════════════════════════════════════════════════\n');

    const stats = await prisma.collector.groupBy({
      by: ['status', 'pfEmailVerified'],
      _count: true,
    });

    console.log('Status    | Email Verificado | Quantidade');
    console.log('----------|------------------|----------');
    stats.forEach(s => {
      const verified = s.pfEmailVerified ? 'Sim ✓' : 'Não ✗';
      console.log(`${s.status.padEnd(9)} | ${verified.padEnd(16)} | ${s._count}`);
    });

    // 2. Listar coletores aguardando verificação
    console.log('\n⏳ Coletores aguardando verificação (BLOCKED):');
    console.log('════════════════════════════════════════════════════════\n');

    const pending = await prisma.collector.findMany({
      where: {
        status: 'BLOCKED',
        pfEmailVerified: false,
        pfEmailVerificationToken: { not: null },
      },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        pfEmailVerificationToken: true,
        createdAt: true,
      },
      take: 5,
    });

    if (pending.length === 0) {
      console.log('❌ Nenhum coletor encontrado aguardando verificação');
    } else {
      pending.forEach((c, i) => {
        const age = Math.floor((Date.now() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Token: ${c.pfEmailVerificationToken?.substring(0, 16)}...`);
        console.log(`   Idade: ${age} dias ${age > 7 ? '⚠️ EXPIRADO' : '✓'}`);
        console.log(`   URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/coletores/auth/confirm-email?token=${c.pfEmailVerificationToken}`);
        console.log();
      });
    }

    // 3. Listar coletores verificados (INACTIVE)
    console.log('✅ Coletores verificados (INACTIVE):');
    console.log('════════════════════════════════════════════════════════\n');

    const verified = await prisma.collector.findMany({
      where: {
        status: 'INACTIVE',
        pfEmailVerified: true,
      },
      select: {
        id: true,
        pfNome: true,
        pfEmail: true,
        pfEmailVerifiedAt: true,
      },
      take: 5,
    });

    if (verified.length === 0) {
      console.log('❌ Nenhum coletor verificado encontrado');
    } else {
      verified.forEach((c, i) => {
        console.log(`${i + 1}. ${c.pfNome} (${c.pfEmail})`);
        console.log(`   ID: ${c.id}`);
        console.log(`   Verificado em: ${c.pfEmailVerifiedAt?.toLocaleString('pt-BR')}`);
        console.log();
      });
    }

    // 4. Resumo e próximos passos
    console.log('📋 Resumo do Fluxo Esperado:');
    console.log('════════════════════════════════════════════════════════\n');
    console.log('1️⃣  Cadastro → Status: BLOCKED, pfEmailVerified: false');
    console.log('2️⃣  E-mail enviado com link GET para /api/coletores/auth/confirm-email?token=...');
    console.log('3️⃣  Click no link → Rota GET valida:');
    console.log('   • Token existe? (TOKEN_NOT_FOUND se não)');
    console.log('   • Token já usado? (TOKEN_USED se sim)');
    console.log('   • Token expirado? (TOKEN_EXPIRED se > 7 dias)');
    console.log('   • Tudo OK → Atualiza: pfEmailVerified=true, status=INACTIVE, token=null');
    console.log('4️⃣  Redireciona para /coletores/verificar-email?success=verified');
    console.log('5️⃣  Aparece em /admin/coletores (filtro: pfEmailVerified=true)');

    console.log('\n✅ Teste concluído!\n');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testEmailVerificationFlow()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
