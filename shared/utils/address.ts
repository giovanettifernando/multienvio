/**
 * Utilitários de formatação de endereço.
 */

export interface AddressInput {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
}

/**
 * Formata endereço completo para exibição em documentos/PDFs.
 *
 * @example
 * formatEndereco({ logradouro: 'Rua A', numero: '123', bairro: 'Centro' })
 * // => "Rua A, 123 - Centro"
 */
export function formatEndereco(address: AddressInput): string {
  const parts = [address.logradouro];
  if (address.numero) parts.push(address.numero);
  if (address.complemento) parts.push(address.complemento);
  parts.push(`- ${address.bairro}`);
  return parts.join(', ').replace(', -', ' -');
}
