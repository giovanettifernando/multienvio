/**
 * Script de teste para verificar conectividade com OpenRouter
 *
 * Executa: npx tsx scripts/test-openrouter.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

async function testBasicChat() {
  console.log('=== Teste 1: Chat básico (sem tools) ===\n');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'user', content: 'Olá! Diga apenas "Funcionando!" em português.' },
      ],
      max_tokens: 50,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('❌ ERRO:', response.status, error);
    return false;
  }

  const data = await response.json();
  console.log('✅ SUCESSO:', data.choices[0].message.content);
  return true;
}

async function testWithTools() {
  console.log('\n=== Teste 2: Chat com tools ===\n');

  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_time',
        description: 'Retorna a hora atual',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'user', content: 'Que horas são?' },
      ],
      tools,
      tool_choice: 'auto',
      max_tokens: 100,
      provider: {
        require_parameters: true,
        allow_fallbacks: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('❌ ERRO:', response.status, error);
    return false;
  }

  const data = await response.json();
  console.log('✅ SUCESSO - Resposta:', JSON.stringify(data.choices[0].message, null, 2));

  if (data.choices[0].message.tool_calls) {
    console.log('🔧 Tool calls detectados:', data.choices[0].message.tool_calls.length);
  }

  return true;
}

async function testWithProviderConfig() {
  console.log('\n=== Teste 3: Chat com tools e config de provider ===\n');

  const tools = [
    {
      type: 'function',
      function: {
        name: 'listar_envios',
        description: 'Lista os envios do usuário',
        parameters: {
          type: 'object',
          properties: {
            limite: { type: 'number', description: 'Quantidade máxima' },
          },
          required: [],
        },
      },
    },
  ];

  // Tentar com diferentes configurações de provider
  const configs = [
    { name: 'Sem provider config', provider: undefined },
    { name: 'Com require_parameters', provider: { require_parameters: true, allow_fallbacks: true } },
  ];

  for (const cfg of configs) {
    console.log(`\nTestando: ${cfg.name}`);

    const body: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: 'system', content: 'Você é um assistente. Use as tools disponíveis quando necessário.' },
        { role: 'user', content: 'Liste meus envios recentes' },
      ],
      tools,
      tool_choice: 'auto',
      max_tokens: 200,
    };

    if (cfg.provider) {
      body.provider = cfg.provider;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('❌ ERRO:', response.status, error.slice(0, 200));
    } else {
      const data = await response.json();
      const msg = data.choices[0].message;
      console.log('✅ SUCESSO');
      console.log('   Content:', msg.content?.slice(0, 100) || '(null)');
      console.log('   Tool calls:', msg.tool_calls ? msg.tool_calls.length : 0);
    }
  }
}

async function main() {
  if (!API_KEY) {
    console.error('❌ OPENROUTER_API_KEY não encontrada em .env.local');
    console.log('Defina: OPENROUTER_API_KEY=sk-or-v1-...');
    process.exit(1);
  }

  console.log('🔑 API Key (últimos 8):', `...${API_KEY.slice(-8)}`);
  console.log('🤖 Model:', MODEL);
  console.log('');

  await testBasicChat();
  await testWithTools();
  await testWithProviderConfig();

  console.log('\n=== Testes concluídos ===');
}

main().catch(console.error);
