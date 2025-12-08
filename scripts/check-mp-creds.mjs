/**
 * Verifica credenciais do Mercado Pago no banco
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Função de descriptografia
function decrypt(ciphertext) {
  if (!ciphertext) return '';

  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    return '[ENCRYPTION_KEY não definida]';
  }

  const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    return ciphertext; // Não está encriptado
  }

  try {
    const [ivHex, authTagHex, encrypted] = parts;

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      KEY_BUFFER,
      Buffer.from(ivHex, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    return '[Erro ao descriptografar: ' + error.message + ']';
  }
}

async function main() {
  console.log('=== VERIFICAÇÃO CREDENCIAIS MERCADO PAGO ===\n');

  const credential = await prisma.paymentCredential.findFirst({
    where: { isActive: true },
    include: { gateway: true },
  });

  if (!credential) {
    console.log('❌ Nenhuma credencial ativa encontrada');
    return;
  }

  console.log('Credencial encontrada:');
  console.log('  ID:', credential.id);
  console.log('  Gateway:', credential.gateway?.name);
  console.log('  Sandbox Mode:', credential.sandboxMode);
  console.log('  Updated at:', credential.updatedAt);
  console.log('');

  // Descriptografar access token
  const accessToken = decrypt(credential.accessToken);
  console.log('Access Token:');
  console.log('  Raw length:', credential.accessToken?.length || 0);
  console.log('  Decrypted prefix:', accessToken.substring(0, 25) + '...');
  console.log('  Decrypted length:', accessToken.length);
  console.log('');

  // Testar token
  console.log('Testando token na API do MP...');

  try {
    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const data = await response.json();

    console.log('  HTTP Status:', response.status);

    if (response.ok) {
      console.log('  ✅ Token VÁLIDO!');
      console.log('  User ID:', data.id);
      console.log('  Email:', data.email);
      console.log('  Site ID:', data.site_id);
    } else {
      console.log('  ❌ Token INVÁLIDO!');
      console.log('  Erro:', data.message);
      console.log('');
      console.log('AÇÃO NECESSÁRIA:');
      console.log('1. Acesse: https://www.mercadopago.com.br/developers/panel');
      console.log('2. Vá em "Credenciais de teste"');
      console.log('3. Copie o Access Token atualizado');
      console.log('4. Atualize em /admin/gateway-pagamento');
    }
  } catch (error) {
    console.log('  ❌ Erro na requisição:', error.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
