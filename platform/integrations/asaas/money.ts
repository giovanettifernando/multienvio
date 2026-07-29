/**
 * Conversão monetária entre o sistema (centavos, Int) e o Asaas (reais, decimal).
 *
 * ESTE É O ÚNICO ARQUIVO AUTORIZADO A MULTIPLICAR OU DIVIDIR VALORES POR 100.
 * Erro de arredondamento em dinheiro só aparece no fechamento contábil — manter
 * a conversão centralizada é o que torna esse bug impossível de espalhar.
 */

function assertFinite(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: ${value}`);
  }
}

/** Converte centavos inteiros para reais com 2 casas decimais. Ex.: 4990 -> 49.9 */
export function toReais(cents: number): number {
  assertFinite(cents);
  if (!Number.isInteger(cents)) {
    throw new Error(`Valor em centavos deve ser inteiro: ${cents}`);
  }
  return Number((cents / 100).toFixed(2));
}

/** Converte reais para centavos inteiros. Ex.: 49.9 -> 4990 */
export function toCents(reais: number): number {
  assertFinite(reais);
  // reais * 100 sozinho sofre com erro de ponto flutuante (ex.: 1.005 * 100 ===
  // 100.49999999999999). Passar por toFixed(2) antes de arredondar normaliza
  // o ruído binário sem exigir uma dependência de decimal arbitrário.
  return Math.round(Number((reais * 100).toFixed(2)));
}
