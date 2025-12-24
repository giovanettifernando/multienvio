/**
 * SECURITY: Validação de arquivos por magic bytes
 *
 * Valida o conteúdo real do arquivo verificando os primeiros bytes (magic bytes)
 * ao invés de confiar apenas na extensão do arquivo, que pode ser falsificada.
 */

// Magic bytes para tipos de arquivo permitidos
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  // Images
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
    // WebP tem "WEBP" no offset 8, mas verificar RIFF já é suficiente com extensão
  ],
  'image/svg+xml': [
    { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c] }, // <?xml
    { bytes: [0x3c, 0x73, 0x76, 0x67] }, // <svg
  ],

  // Documents
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF

  // Office documents (OOXML)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP header - DOCX)
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP header - XLSX)
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP header - PPTX)
  ],

  // Legacy Office (OLE2)
  'application/msword': [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  ],
  'application/vnd.ms-excel': [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  ],

  // Text
  'text/plain': [], // Text files don't have magic bytes
  'text/csv': [], // CSV files don't have magic bytes

  // Archives
  'application/zip': [{ bytes: [0x50, 0x4b, 0x03, 0x04] }],
};

// Extensões permitidas por tipo MIME
const EXTENSION_TO_MIME: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv'],
  '.zip': ['application/zip'],
};

// Extensões perigosas que nunca devem ser permitidas
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.sh',
  '.bash',
  '.ps1',
  '.vbs',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jar',
  '.class',
  '.py',
  '.pyc',
  '.php',
  '.phtml',
  '.asp',
  '.aspx',
  '.jsp',
  '.jspx',
  '.htaccess',
  '.htpasswd',
  '.config',
  '.ini',
  '.env',
  '.sql',
  '.db',
  '.sqlite',
  '.msi',
  '.scr',
  '.com',
  '.pif',
  '.cpl',
  '.hta',
  '.wsf',
  '.wsh',
  '.reg',
  '.inf',
];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime?: string;
}

/**
 * Detecta o tipo MIME de um arquivo baseado nos magic bytes
 */
function detectMimeFromBytes(buffer: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    if (signatures.length === 0) continue; // Text files

    for (const sig of signatures) {
      const offset = sig.offset ?? 0;
      if (buffer.length < offset + sig.bytes.length) continue;

      let matches = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (buffer[offset + i] !== sig.bytes[i]) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return mime;
      }
    }
  }

  return null;
}

/**
 * Extrai a extensão de um nome de arquivo
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Valida um arquivo verificando:
 * 1. Extensão não é perigosa
 * 2. Extensão está na lista permitida
 * 3. Magic bytes correspondem ao tipo declarado
 *
 * @param buffer - Conteúdo do arquivo como Buffer
 * @param filename - Nome original do arquivo
 * @param allowedExtensions - Lista de extensões permitidas (ex: ['.jpg', '.png', '.pdf'])
 */
export function validateFileContent(
  buffer: Buffer,
  filename: string,
  allowedExtensions?: string[]
): FileValidationResult {
  const extension = getFileExtension(filename);

  // 1. Verificar extensões perigosas
  if (DANGEROUS_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Extensão de arquivo não permitida: ${extension}`,
    };
  }

  // 2. Verificar se extensão está na lista permitida (se fornecida)
  if (allowedExtensions && allowedExtensions.length > 0) {
    const normalizedAllowed = allowedExtensions.map((e) => e.toLowerCase());
    if (!normalizedAllowed.includes(extension)) {
      return {
        valid: false,
        error: `Extensão não permitida: ${extension}. Permitidas: ${allowedExtensions.join(', ')}`,
      };
    }
  }

  // 3. Detectar MIME type por magic bytes
  const detectedMime = detectMimeFromBytes(buffer);

  // 4. Para arquivos de texto (sem magic bytes), verificar se são realmente texto
  const expectedMimes = EXTENSION_TO_MIME[extension] || [];
  const isTextFile = expectedMimes.some((m) => m.startsWith('text/'));

  if (isTextFile) {
    // Verificar se o buffer contém apenas caracteres de texto válidos
    const isValidText = validateTextContent(buffer);
    if (!isValidText) {
      return {
        valid: false,
        error: 'Arquivo de texto contém caracteres binários inválidos',
      };
    }
    return {
      valid: true,
      detectedMime: expectedMimes[0],
    };
  }

  // 5. Para arquivos com magic bytes, verificar correspondência
  if (!detectedMime) {
    // Se não conseguiu detectar o MIME, verificar se a extensão é conhecida
    if (extension && !EXTENSION_TO_MIME[extension]) {
      return {
        valid: false,
        error: `Tipo de arquivo não suportado: ${extension}`,
      };
    }
    // Extensão conhecida mas sem magic bytes detectáveis (pode ser arquivo corrompido)
    return {
      valid: false,
      error: 'Não foi possível verificar o tipo de arquivo',
    };
  }

  // 6. Verificar se o MIME detectado corresponde à extensão declarada
  if (expectedMimes.length > 0 && !expectedMimes.includes(detectedMime)) {
    // Exceção para OOXML (docx, xlsx, pptx) - todos têm o mesmo magic byte (PK)
    const isOoxml =
      detectedMime === 'application/zip' &&
      ['.docx', '.xlsx', '.pptx'].includes(extension);
    if (!isOoxml) {
      return {
        valid: false,
        error: `Conteúdo do arquivo não corresponde à extensão. Esperado: ${expectedMimes.join(' ou ')}, detectado: ${detectedMime}`,
      };
    }
  }

  return {
    valid: true,
    detectedMime,
  };
}

/**
 * Verifica se o buffer contém conteúdo de texto válido
 */
function validateTextContent(buffer: Buffer): boolean {
  // Verificar BOM de UTF-8
  const hasUtf8Bom =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

  // Verificar caracteres inválidos (bytes de controle exceto newlines e tabs)
  const start = hasUtf8Bom ? 3 : 0;
  for (let i = start; i < Math.min(buffer.length, 8192); i++) {
    const byte = buffer[i];
    // Permitir: newline (10), carriage return (13), tab (9), e caracteres imprimíveis
    if (byte < 9 || (byte > 13 && byte < 32 && byte !== 27)) {
      // byte 27 = ESC para ANSI
      return false;
    }
  }

  return true;
}

/**
 * Conjunto de extensões para uploads de suporte (documentos + imagens)
 */
export const SUPPORT_ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
  '.zip',
];

/**
 * Conjunto de extensões para uploads de imagens apenas
 */
export const IMAGE_ONLY_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * Conjunto de extensões para documentos de coletores
 */
export const COLLECTOR_DOC_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
