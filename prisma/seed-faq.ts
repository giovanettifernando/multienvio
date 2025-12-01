/**
 * Script para popular FAQ com dados iniciais
 * Execute com: npx tsx prisma/seed-faq.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const faqItems = [
  // ============== CATEGORIA: ENVIOS ==============
  {
    question: 'Como faço para enviar um pacote pelo Envio Legal?',
    answer: `Para enviar um pacote pelo Envio Legal, siga estes passos simples:

1. Faça login na sua conta ou crie uma nova
2. Clique em "Novo Envio" no menu principal
3. Preencha os dados do remetente e destinatário
4. Informe as dimensões e peso do pacote
5. Escolha a transportadora de sua preferência
6. Efetue o pagamento (cartão, PIX ou saldo da carteira)
7. Imprima a etiqueta gerada e cole no pacote
8. Leve o pacote até um ponto de coleta ou agende uma coleta em domicílio`,
    category: 'Envios',
    audience: 'USER' as const,
    sortOrder: 1,
  },
  {
    question: 'Quais são as dimensões máximas permitidas para envio?',
    answer: `As dimensões máximas variam de acordo com a transportadora escolhida. Em geral:

- Comprimento máximo: 100 cm
- Largura máxima: 80 cm
- Altura máxima: 80 cm
- Soma das dimensões (C+L+A): máximo 200 cm
- Peso máximo: 30 kg

Para pacotes maiores ou mais pesados, entre em contato com nosso suporte para soluções personalizadas.`,
    category: 'Envios',
    audience: 'USER' as const,
    sortOrder: 2,
  },
  {
    question: 'Posso cancelar um envio já pago?',
    answer: `Sim, você pode cancelar um envio nas seguintes condições:

- Se a etiqueta ainda não foi utilizada (pacote não postado)
- Dentro do prazo de 7 dias após a emissão

Para cancelar:
1. Acesse "Meus Envios"
2. Localize o envio que deseja cancelar
3. Clique no botão "Cancelar"
4. O valor será estornado para sua carteira digital em até 24h

Após a postagem do pacote, não é possível cancelar o envio.`,
    category: 'Envios',
    audience: 'USER' as const,
    sortOrder: 3,
  },

  // ============== CATEGORIA: PAGAMENTOS ==============
  {
    question: 'Quais formas de pagamento são aceitas?',
    answer: `Aceitamos as seguintes formas de pagamento:

- Cartão de crédito (Visa, Mastercard, Elo, American Express)
- Cartão de débito
- PIX (pagamento instantâneo)
- Saldo da Carteira Digital Envio Legal

Os pagamentos via PIX são processados instantaneamente. Cartões de crédito podem ter aprovação em até 2 minutos.`,
    category: 'Pagamentos',
    audience: 'USER' as const,
    sortOrder: 10,
  },
  {
    question: 'Como funciona a Carteira Digital?',
    answer: `A Carteira Digital é sua conta de créditos no Envio Legal:

- Você pode adicionar saldo a qualquer momento via PIX ou cartão
- Use o saldo para pagar seus envios de forma rápida
- Receba estornos de cancelamentos diretamente na carteira
- Não há taxa para manter a carteira
- Saldo não expira

Para adicionar créditos:
1. Acesse "Carteira" no menu
2. Clique em "Adicionar saldo"
3. Escolha o valor e forma de pagamento`,
    category: 'Pagamentos',
    audience: 'USER' as const,
    sortOrder: 11,
  },
  {
    question: 'O pagamento foi recusado. O que fazer?',
    answer: `Se seu pagamento foi recusado, verifique:

1. Os dados do cartão estão corretos (número, validade, CVV)
2. Há limite disponível no cartão
3. O cartão não está bloqueado
4. O 3D Secure (autenticação) foi completado

Dicas:
- Tente outro cartão ou método de pagamento
- Entre em contato com seu banco se o problema persistir
- Use PIX para pagamento instantâneo sem risco de recusa

Se o problema continuar, abra um chamado de suporte.`,
    category: 'Pagamentos',
    audience: 'USER' as const,
    sortOrder: 12,
  },

  // ============== CATEGORIA: RASTREAMENTO ==============
  {
    question: 'Como rastrear meu envio?',
    answer: `Você pode rastrear seu envio de duas formas:

1. Pelo painel logado:
   - Acesse "Meus Envios"
   - Clique no envio desejado
   - Veja o histórico de rastreamento em tempo real

2. Pela página pública:
   - Acesse enviolegal.com.br/rastreio
   - Digite o código de rastreamento
   - Visualize o status atualizado

O código de rastreamento é enviado por e-mail após a confirmação do pagamento.`,
    category: 'Rastreamento',
    audience: 'USER' as const,
    sortOrder: 20,
  },
  {
    question: 'Meu rastreamento não atualiza há dias. É normal?',
    answer: `Em algumas situações o rastreamento pode demorar a atualizar:

Situações normais (aguarde):
- Feriados e finais de semana (transportadoras não atualizam)
- Pacote em trânsito entre cidades (pode levar 2-3 dias sem atualização)
- Alta demanda em datas especiais

Quando se preocupar:
- Mais de 5 dias úteis sem atualização
- Status "Objeto não localizado" persistente

Nestes casos, abra um chamado de suporte com o código de rastreamento que investigaremos junto à transportadora.`,
    category: 'Rastreamento',
    audience: 'USER' as const,
    sortOrder: 21,
  },

  // ============== CATEGORIA: CONTA ==============
  {
    question: 'Esqueci minha senha. Como recuperar?',
    answer: `Para recuperar sua senha:

1. Na tela de login, clique em "Esqueci minha senha"
2. Digite o e-mail cadastrado
3. Você receberá um link de recuperação por e-mail
4. Clique no link (válido por 24 horas)
5. Defina uma nova senha

Dica: Verifique a pasta de spam se não encontrar o e-mail.

Se não receber o e-mail de recuperação, entre em contato com o suporte.`,
    category: 'Conta',
    audience: 'USER' as const,
    sortOrder: 30,
  },
  {
    question: 'Como alterar meus dados cadastrais?',
    answer: `Para atualizar seus dados:

1. Acesse "Minha Conta" no menu superior
2. Clique em "Editar Perfil"
3. Atualize as informações desejadas:
   - Nome
   - Telefone
   - Endereço principal
4. Clique em "Salvar alterações"

O e-mail não pode ser alterado por segurança. Para trocar o e-mail, entre em contato com o suporte.`,
    category: 'Conta',
    audience: 'USER' as const,
    sortOrder: 31,
  },

  // ============== CATEGORIA: COLETA ==============
  {
    question: 'Como funciona a coleta em domicílio?',
    answer: `A coleta em domicílio permite que o entregador busque seu pacote:

1. Ao criar o envio, selecione "Coleta em domicílio"
2. Escolha a data e período (manhã, tarde ou dia todo)
3. Finalize o pagamento (há uma taxa adicional de coleta)
4. Aguarde o coletor no endereço informado

Importante:
- Tenha o pacote pronto e etiquetado
- Alguém deve estar no local para entregar o pacote
- O coletor não sobe para retirar pacotes
- Guarde o comprovante de coleta`,
    category: 'Coleta',
    audience: 'USER' as const,
    sortOrder: 40,
  },
  {
    question: 'Onde encontro os pontos de coleta mais próximos?',
    answer: `Para encontrar pontos de coleta:

1. Acesse "Pontos de Coleta" no menu
2. Digite seu CEP ou endereço
3. Veja os pontos mais próximos no mapa
4. Consulte horários de funcionamento e serviços disponíveis

Dica: Ao criar um envio, o sistema mostra automaticamente os pontos de coleta mais próximos do seu endereço de origem.`,
    category: 'Coleta',
    audience: 'USER' as const,
    sortOrder: 41,
  },

  // ============== CATEGORIA: PROBLEMAS ==============
  {
    question: 'Meu pacote foi extraviado. O que fazer?',
    answer: `Se seu pacote foi extraviado (perdido em trânsito):

1. Abra um chamado de suporte com:
   - Código de rastreamento
   - Nota fiscal ou declaração de conteúdo
   - Fotos do pacote (se tiver)

2. Investigação:
   - Abriremos sindicância junto à transportadora
   - Prazo de investigação: até 10 dias úteis

3. Indenização:
   - Se confirmado o extravio, você será indenizado
   - Valor: declarado no envio ou limite do seguro contratado
   - Prazo de reembolso: até 5 dias úteis após aprovação

Sempre declare o valor correto dos itens ao criar o envio.`,
    category: 'Problemas',
    audience: 'USER' as const,
    sortOrder: 50,
  },
  {
    question: 'Recebi um pacote avariado. Como proceder?',
    answer: `Se recebeu um pacote com avarias:

1. Ao receber:
   - Fotografe a embalagem antes de abrir
   - Se possível, recuse o recebimento anotando "avariado"
   - Se já recebeu, fotografe o conteúdo danificado

2. Registre uma ocorrência:
   - Abra um chamado de suporte em até 7 dias
   - Anexe todas as fotos
   - Descreva os danos detalhadamente

3. Análise:
   - Avaliaremos a ocorrência
   - Você será orientado sobre a indenização

Importante: Guarde a embalagem original até a conclusão da análise.`,
    category: 'Problemas',
    audience: 'USER' as const,
    sortOrder: 51,
  },
];

async function main() {
  console.log('🌱 Populando FAQ com dados iniciais...\n');

  // Verificar se já existem FAQs
  const existingCount = await prisma.fAQItem.count();
  if (existingCount > 0) {
    console.log(`⚠️  Já existem ${existingCount} FAQs no banco.`);
    console.log('   Use --force para substituir os dados existentes.\n');

    if (!process.argv.includes('--force')) {
      console.log('❌ Operação cancelada. Execute com --force para sobrescrever.');
      return;
    }

    console.log('🗑️  Removendo FAQs existentes...');
    await prisma.fAQItem.deleteMany();
  }

  // Inserir novos FAQs
  console.log(`📝 Inserindo ${faqItems.length} perguntas frequentes...`);

  for (const item of faqItems) {
    await prisma.fAQItem.create({
      data: {
        question: item.question,
        answer: item.answer,
        category: item.category,
        audience: item.audience,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
    console.log(`   ✅ ${item.category}: ${item.question.substring(0, 50)}...`);
  }

  console.log(`\n🎉 FAQ populado com sucesso! Total: ${faqItems.length} itens`);

  // Estatísticas por categoria
  const stats = await prisma.fAQItem.groupBy({
    by: ['category'],
    _count: { id: true },
  });

  console.log('\n📊 Estatísticas por categoria:');
  for (const stat of stats) {
    console.log(`   ${stat.category}: ${stat._count.id} perguntas`);
  }
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
