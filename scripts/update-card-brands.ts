/**
 * Script para atualizar bandeiras de cartões baseado no BIN
 *
 * Uso: npx tsx scripts/update-card-brands.ts
 */

import { PrismaClient } from "@prisma/client";
import { parseFingerprint } from "../lib/crypto/card-vault";

const prisma = new PrismaClient();

// Tabela de BINs para identificação de bandeiras
// Fonte: https://en.wikipedia.org/wiki/Payment_card_number
function detectBrandFromBin(bin: string): string {
  const binNum = parseInt(bin, 10);
  const bin2 = bin.slice(0, 2);
  const bin4 = bin.slice(0, 4);
  const bin6 = bin;

  // American Express: começa com 34 ou 37
  if (bin2 === "34" || bin2 === "37") {
    return "AMEX";
  }

  // Visa: começa com 4
  if (bin[0] === "4") {
    return "VISA";
  }

  // Mastercard: 51-55, 2221-2720, ou 50 (alguns ranges de teste)
  const bin2Num = parseInt(bin2, 10);
  const bin4Num = parseInt(bin4, 10);
  if ((bin2Num >= 51 && bin2Num <= 55) || (bin4Num >= 2221 && bin4Num <= 2720)) {
    return "MASTERCARD";
  }

  // Mastercard ranges adicionais (incluindo cartões de teste do Mercado Pago)
  const mastercardTestRanges = ["503143", "5031"];
  for (const range of mastercardTestRanges) {
    if (bin6.startsWith(range) || bin4.startsWith(range)) {
      return "MASTERCARD";
    }
  }

  // Elo: ranges específicos
  const eloRanges = [
    "636368", "438935", "504175", "451416", "636297", "5067", "4576", "4011",
    "506699", "509048", "509067", "509049", "509069", "509050", "509074",
    "509068", "509040", "509045", "509051", "509046", "509066", "509047",
    "509042", "509052", "509043", "509064", "509040"
  ];
  for (const range of eloRanges) {
    if (bin6.startsWith(range) || bin4.startsWith(range)) {
      return "ELO";
    }
  }

  // Hipercard: começa com 606282 ou 38 (alguns)
  if (bin6.startsWith("606282") || bin6.startsWith("637095") || bin6.startsWith("637568") || bin6.startsWith("637599") || bin6.startsWith("637609") || bin6.startsWith("637612")) {
    return "HIPERCARD";
  }

  // Discover: 6011, 622126-622925, 644-649, 65
  if (bin4 === "6011" || bin2 === "65" || (bin2Num >= 64 && bin2Num <= 65)) {
    return "DISCOVER";
  }

  // Diners Club: 300-305, 36, 38
  if ((bin2Num >= 30 && bin2Num <= 30) || bin2 === "36" || bin2 === "38") {
    return "DINERS";
  }

  // JCB: 3528-3589
  const bin4JCB = parseInt(bin4, 10);
  if (bin4JCB >= 3528 && bin4JCB <= 3589) {
    return "JCB";
  }

  return "OTHER";
}

async function main() {
  console.log("🔍 Buscando cartões com bandeira 'OTHER' ou indefinida...\n");

  const cards = await prisma.card.findMany({
    where: {
      brand: "OTHER",
    },
    select: {
      id: true,
      fingerprint: true,
      brand: true,
      last4: true,
      userId: true,
    },
  });

  console.log(`📋 Encontrados ${cards.length} cartões para atualizar\n`);

  if (cards.length === 0) {
    console.log("✅ Nenhum cartão precisa de atualização.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const card of cards) {
    try {
      const { bin } = parseFingerprint(card.fingerprint);
      const newBrand = detectBrandFromBin(bin);

      if (newBrand === "OTHER") {
        console.log(`⏭️  Cartão ${card.id} (****${card.last4}): BIN ${bin} - não identificado, mantendo OTHER`);
        skipped++;
        continue;
      }

      await prisma.card.update({
        where: { id: card.id },
        data: { brand: newBrand },
      });

      console.log(`✅ Cartão ${card.id} (****${card.last4}): ${card.brand || "null"} → ${newBrand} (BIN: ${bin})`);
      updated++;
    } catch (error) {
      console.error(`❌ Erro no cartão ${card.id}:`, error);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Resumo:`);
  console.log(`   ✅ Atualizados: ${updated}`);
  console.log(`   ⏭️  Ignorados: ${skipped}`);
  console.log(`   ❌ Erros: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
