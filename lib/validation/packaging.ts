import { z } from 'zod';

/**
 * Formata um número removendo zeros desnecessários
 */
function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/**
 * Gera nome automático no formato C (xx) x L (xx) x A (xx)
 */
function generateAutoName(lengthCm: number, widthCm: number, heightCm: number): string {
  const length = formatNumber(lengthCm);
  const width = formatNumber(widthCm);
  const height = formatNumber(heightCm);
  return `C (${length}) x L (${width}) x A (${height})`;
}

/**
 * Schema para criação de embalagem
 */
export const packagingCreateSchema = z.object({
  name: z.string().trim().optional(),
  lengthCm: z
    .number({ message: 'Comprimento é obrigatório' })
    .positive('Comprimento deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2))),
  widthCm: z
    .number({ message: 'Largura é obrigatória' })
    .positive('Largura deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2))),
  heightCm: z
    .number({ message: 'Altura é obrigatória' })
    .positive('Altura deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2))),
}).transform((data) => {
  // Se o nome não for informado, gerar automaticamente
  if (!data.name) {
    data.name = generateAutoName(data.lengthCm, data.widthCm, data.heightCm);
  }
  return data;
});

export type PackagingCreateInput = z.input<typeof packagingCreateSchema>;
export type PackagingCreateOutput = z.output<typeof packagingCreateSchema>;

/**
 * Schema para atualização de embalagem
 */
const packagingUpdateBaseSchema = z.object({
  name: z.string().trim().optional(),
  lengthCm: z
    .number({ message: 'Comprimento é obrigatório' })
    .positive('Comprimento deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
  widthCm: z
    .number({ message: 'Largura é obrigatória' })
    .positive('Largura deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
  heightCm: z
    .number({ message: 'Altura é obrigatória' })
    .positive('Altura deve ser maior que 0')
    .transform((val) => Number(val.toFixed(2)))
    .optional(),
});

export const packagingUpdateSchema = packagingUpdateBaseSchema.transform((data) => {
  // Se houver dados de dimensões e o nome não estiver definido, gerar automaticamente
  if (!data.name && data.lengthCm && data.widthCm && data.heightCm) {
    data.name = generateAutoName(data.lengthCm, data.widthCm, data.heightCm);
  }
  return data;
});

export type PackagingUpdateInput = z.input<typeof packagingUpdateSchema>;
export type PackagingUpdateOutput = z.output<typeof packagingUpdateSchema>;
