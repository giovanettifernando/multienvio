/**
 * Upload de arquivos para documentos de coletores
 * Faz upload real via API em vez de converter para base64
 */

export interface UploadResult {
  url: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Faz upload de um arquivo para o servidor
 * @param file - Arquivo a ser enviado
 * @param documentType - Tipo do documento (cnh, crlv, address_proof)
 * @returns URL pública do arquivo
 */
export async function uploadFile(file: File, documentType = 'document'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await fetch('/api/public/upload/collector-document', {
    method: 'POST',
    body: formData,
  });

  // Clone response to avoid "body already consumed" issues
  const text = await response.text();

  let data: UploadResult | { message?: string };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Resposta inválida do servidor');
  }

  if (!response.ok) {
    throw new Error((data as { message?: string }).message || 'Erro ao fazer upload do arquivo');
  }

  return (data as UploadResult).url;
}

/**
 * Faz upload de múltiplos arquivos
 * @param files - Array de arquivos
 * @param documentType - Tipo do documento
 * @returns Array de URLs públicas
 */
export async function uploadFiles(files: File[], documentType = 'document'): Promise<string[]> {
  const results = await Promise.all(
    files.map(file => uploadFile(file, documentType))
  );
  return results;
}
