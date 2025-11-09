/**
 * Formata um número removendo zeros desnecessários
 * Mantém até 2 casas decimais quando necessário
 */
function formatNumber(value: number): string {
  // Arredondar para 2 casas decimais
  const rounded = Math.round(value * 100) / 100;

  // Converter para string e remover zeros à direita
  return rounded.toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Formata o nome de exibição de uma embalagem
 * Se houver nome customizado, usa ele
 * Caso contrário, gera formato: C (xx) x L (xx) x A (xx)
 */
export function formatPackagingName(params: {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  name?: string | null;
}): string {
  const { lengthCm, widthCm, heightCm, name } = params;

  // Se houver nome customizado, usar ele
  if (name) {
    return name;
  }

  // Caso contrário, gerar formato padrão
  const length = formatNumber(lengthCm);
  const width = formatNumber(widthCm);
  const height = formatNumber(heightCm);

  return `C (${length}) x L (${width}) x A (${height})`;
}
