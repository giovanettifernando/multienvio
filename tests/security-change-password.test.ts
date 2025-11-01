/**
 * Testes para o endpoint de alteração de senha
 *
 * Para rodar:
 * npx tsx tests/security-change-password.test.ts
 */

import { validatePasswordPolicy, isPasswordReused, updatePasswordHistory } from '../lib/validation/password-policy';
import bcrypt from 'bcrypt';

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Contador de testes
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    log(`✓ ${message}`, 'green');
  } else {
    failed++;
    log(`✗ ${message}`, 'red');
  }
}

function assertEquals<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    log(`✓ ${message}`, 'green');
  } else {
    failed++;
    log(`✗ ${message}`, 'red');
    log(`  Expected: ${JSON.stringify(expected)}`, 'yellow');
    log(`  Actual: ${JSON.stringify(actual)}`, 'yellow');
  }
}

async function runTests() {
  log('\n=== Testes de Política de Senha ===\n', 'blue');

  // Teste 1: Senha válida
  const validPassword = 'MyP@ssw0rd!';
  const result1 = validatePasswordPolicy(validPassword);
  assert(result1.valid === true, 'Senha válida deve passar na validação');

  // Teste 2: Senha muito curta
  const shortPassword = 'Ab1!';
  const result2 = validatePasswordPolicy(shortPassword);
  assert(result2.valid === false, 'Senha muito curta deve falhar');
  assert(result2.errors.length > 0, 'Senha muito curta deve retornar erros');

  // Teste 3: Senha sem maiúscula
  const noUppercase = 'myp@ssw0rd!';
  const result3 = validatePasswordPolicy(noUppercase);
  assert(result3.valid === false, 'Senha sem maiúscula deve falhar');

  // Teste 4: Senha sem minúscula
  const noLowercase = 'MYP@SSW0RD!';
  const result4 = validatePasswordPolicy(noLowercase);
  assert(result4.valid === false, 'Senha sem minúscula deve falhar');

  // Teste 5: Senha sem número
  const noNumber = 'MyPassword!';
  const result5 = validatePasswordPolicy(noNumber);
  assert(result5.valid === false, 'Senha sem número deve falhar');

  // Teste 6: Senha sem caractere especial
  const noSpecial = 'MyPassword123';
  const result6 = validatePasswordPolicy(noSpecial);
  assert(result6.valid === false, 'Senha sem caractere especial deve falhar');

  // Teste 7: Senha muito comum
  const commonPassword = 'password';
  const result7 = validatePasswordPolicy(commonPassword);
  assert(result7.valid === false, 'Senha muito comum deve falhar');

  log('\n=== Testes de Reutilização de Senha ===\n', 'blue');

  // Teste 8: Verificar reutilização (sem histórico)
  const newPassword = 'NewP@ssw0rd123!';
  const result8 = await isPasswordReused(newPassword, null, bcrypt.compare);
  assert(result8 === false, 'Sem histórico, não deve ser considerada reutilizada');

  // Teste 9: Verificar reutilização (com histórico vazio)
  const result9 = await isPasswordReused(newPassword, [], bcrypt.compare);
  assert(result9 === false, 'Com histórico vazio, não deve ser considerada reutilizada');

  // Teste 10: Verificar reutilização (senha nova)
  const oldHash = await bcrypt.hash('OldP@ssw0rd123!', 12);
  const result10 = await isPasswordReused(newPassword, [oldHash], bcrypt.compare);
  assert(result10 === false, 'Senha diferente não deve ser considerada reutilizada');

  // Teste 11: Verificar reutilização (senha reutilizada)
  const reusedPasswordHash = await bcrypt.hash(newPassword, 12);
  const result11 = await isPasswordReused(newPassword, [reusedPasswordHash], bcrypt.compare);
  assert(result11 === true, 'Senha igual no histórico deve ser detectada como reutilizada');

  log('\n=== Testes de Atualização de Histórico ===\n', 'blue');

  // Teste 12: Atualizar histórico vazio
  const currentHash = await bcrypt.hash('CurrentP@ss123!', 12);
  const history1 = updatePasswordHistory(currentHash, null);
  assertEquals(history1.length, 1, 'Histórico vazio deve receber 1 item');

  // Teste 13: Atualizar histórico com 1 item
  const history2 = updatePasswordHistory(currentHash, [oldHash]);
  assertEquals(history2.length, 2, 'Histórico com 1 item deve ter 2 itens após update');

  // Teste 14: Atualizar histórico com 5 itens (máximo)
  const hashes = [
    await bcrypt.hash('Pass1@Test', 12),
    await bcrypt.hash('Pass2@Test', 12),
    await bcrypt.hash('Pass3@Test', 12),
    await bcrypt.hash('Pass4@Test', 12),
    await bcrypt.hash('Pass5@Test', 12),
  ];
  const history3 = updatePasswordHistory(currentHash, hashes);
  assertEquals(history3.length, 5, 'Histórico deve manter no máximo 5 itens');
  assertEquals(history3[0], currentHash, 'Primeiro item deve ser o hash atual');

  log('\n=== Resumo dos Testes ===\n', 'blue');
  log(`Total: ${passed + failed} testes`, 'blue');
  log(`Passou: ${passed} testes`, 'green');
  if (failed > 0) {
    log(`Falhou: ${failed} testes`, 'red');
    process.exit(1);
  } else {
    log('Todos os testes passaram!', 'green');
    process.exit(0);
  }
}

// Executar testes
runTests().catch((error) => {
  log(`\n✗ Erro ao executar testes: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
