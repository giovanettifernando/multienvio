/**
 * Script de teste para alteração de senha
 *
 * Este script testa o endpoint POST /api/account/password
 * com diversos cenários de validação.
 */

// Teste de validação do schema
const testCases = [
  {
    name: "Senha válida",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmNewPassword: "NewPassword123!"
    },
    expectError: false
  },
  {
    name: "Senha sem maiúscula",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "newpassword123!",
      confirmNewPassword: "newpassword123!"
    },
    expectError: true,
    expectedMessage: "A senha deve conter pelo menos uma letra maiúscula"
  },
  {
    name: "Senha sem número",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword!",
      confirmNewPassword: "NewPassword!"
    },
    expectError: true,
    expectedMessage: "A senha deve conter pelo menos um número"
  },
  {
    name: "Senha sem caractere especial",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123",
      confirmNewPassword: "NewPassword123"
    },
    expectError: true,
    expectedMessage: "A senha deve conter pelo menos um caractere especial"
  },
  {
    name: "Senhas não conferem",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmNewPassword: "DifferentPassword123!"
    },
    expectError: true,
    expectedMessage: "As senhas não conferem"
  },
  {
    name: "Senha muito curta",
    payload: {
      currentPassword: "OldPassword123!",
      newPassword: "Short1!",
      confirmNewPassword: "Short1!"
    },
    expectError: true,
    expectedMessage: "A senha deve ter no mínimo 8 caracteres"
  }
];

console.log("=".repeat(60));
console.log("TESTE DE VALIDAÇÃO DE SENHA - Frontend");
console.log("=".repeat(60));
console.log("\nEsses são os cenários que devem ser testados no navegador:\n");

testCases.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   Payload:`, JSON.stringify(test.payload, null, 2));
  if (test.expectError) {
    console.log(`   ❌ Deve falhar com: "${test.expectedMessage}"`);
  } else {
    console.log(`   ✅ Deve ter sucesso (mas vai falhar se senha atual estiver incorreta)`);
  }
  console.log("");
});

console.log("=".repeat(60));
console.log("INSTRUÇÕES:");
console.log("=".repeat(60));
console.log(`
1. Certifique-se de que o servidor está rodando: npm run dev
2. Abra http://localhost:3000/minha-conta#security
3. Teste cada cenário acima
4. Verifique os logs do servidor para mensagens detalhadas

Para ver os logs detalhados no servidor, procure por:
  [change-password] Request body: ...
  [change-password] Validation failed: ...
`);
