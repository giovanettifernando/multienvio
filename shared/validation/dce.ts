/**
 * Chave de acesso da DC-e (Declaração de Conteúdo eletrônica).
 *
 * São 44 dígitos formados pela concatenação de campos do próprio documento,
 * com dígito verificador módulo 11 — o mesmo algoritmo da NF-e. Referência:
 * Manual DC-e — Visão Geral, seção 2.2.4.
 *
 * O que separa uma DC-e de uma NF-e é o campo `modelo`. Sem conferir isso, uma
 * chave de nota fiscal colada por engano passaria batido: ela tem o mesmo
 * tamanho e o mesmo dígito verificador.
 */

import { onlyDigits } from '@/shared/utils/masks';

/** Modelo do documento na chave de acesso. A NF-e usa '55'. */
export const DCE_MODELO = '99';

export type DceKeyParts = {
  cUF: string;
  anoMes: string;
  cnpjEmitente: string;
  modelo: string;
  serie: string;
  numero: string;
  tpEmis: string;
  /** 0=App do Fisco, 1=Marketplace, 2=Emissor próprio, 3=Transportadora */
  tpEmit: string;
  siteAutorizador: string;
  codigoNumerico: string;
  dv: string;
};

/**
 * Dígito verificador módulo 11: cada algarismo, da direita para a esquerda, é
 * multiplicado pela sequência cíclica 2,3,4,5,6,7,8,9. Resto 0 ou 1 resulta em
 * DV zero.
 */
function calcularDv(base43: string): number {
  let soma = 0;
  let peso = 2;

  for (let i = base43.length - 1; i >= 0; i -= 1) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

export function isValidDceKey(value: string): boolean {
  const digits = onlyDigits(value ?? '');

  if (digits.length !== 44) return false;
  if (digits.slice(20, 22) !== DCE_MODELO) return false;

  return calcularDv(digits.slice(0, 43)) === Number(digits[43]);
}

export function parseDceKey(value: string): DceKeyParts | null {
  if (!isValidDceKey(value)) return null;

  const d = onlyDigits(value);

  return {
    cUF: d.slice(0, 2),
    anoMes: d.slice(2, 6),
    cnpjEmitente: d.slice(6, 20),
    modelo: d.slice(20, 22),
    serie: d.slice(22, 25),
    numero: d.slice(25, 34),
    tpEmis: d.slice(34, 35),
    tpEmit: d.slice(35, 36),
    siteAutorizador: d.slice(36, 37),
    codigoNumerico: d.slice(37, 43),
    dv: d.slice(43, 44),
  };
}
