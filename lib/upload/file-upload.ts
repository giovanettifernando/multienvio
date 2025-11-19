/**
 * Utilitário para fazer upload de arquivos
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'divergences');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadedFile {
  url: string;
  path: string;
  size: number;
  type: string;
}

/**
 * Salva uma imagem em base64 no sistema de arquivos
 */
export async function saveBase64Image(
  base64Data: string,
  filename: string
): Promise<UploadedFile> {
  // Extrair o tipo e os dados do base64
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error('Formato de imagem base64 inválido');
  }

  const type = matches[1];
  const data = matches[2];

  // Validar tipo de arquivo
  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(`Tipo de arquivo não permitido. Use: ${ALLOWED_TYPES.join(', ')}`);
  }

  // Converter base64 para buffer
  const buffer = Buffer.from(data, 'base64');

  // Validar tamanho
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Criar diretório se não existir
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Gerar nome único para o arquivo
  const timestamp = Date.now();
  const extension = type.split('/')[1];
  const uniqueFilename = `${timestamp}-${filename}.${extension}`;
  const filePath = join(UPLOAD_DIR, uniqueFilename);

  // Salvar arquivo
  await writeFile(filePath, buffer);

  // Retornar URL pública
  const publicUrl = `/uploads/divergences/${uniqueFilename}`;

  return {
    url: publicUrl,
    path: filePath,
    size: buffer.length,
    type,
  };
}

/**
 * Valida se uma string é uma imagem base64 válida
 */
export function validateBase64Image(base64Data: string): { valid: boolean; error?: string } {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    return { valid: false, error: 'Formato de imagem base64 inválido' };
  }

  const type = matches[1];
  const data = matches[2];

  if (!ALLOWED_TYPES.includes(type)) {
    return { valid: false, error: `Tipo de arquivo não permitido. Use: ${ALLOWED_TYPES.join(', ')}` };
  }

  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }

  return { valid: true };
}
