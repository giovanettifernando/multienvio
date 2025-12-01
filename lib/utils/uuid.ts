/**
 * Gera um UUID v4 de forma segura para todos os navegadores.
 *
 * Usa crypto.randomUUID() quando disponível (navegadores modernos),
 * caso contrário usa fallback com crypto.getRandomValues().
 *
 * Compatível com:
 * - Safari iOS 15.4+
 * - Chrome 92+
 * - Firefox 95+
 * - Fallback para navegadores mais antigos
 */
export function generateUUID(): string {
  // Verificar se crypto.randomUUID está disponível
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback usando crypto.getRandomValues (mais amplo suporte)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Ajustar bytes para UUID v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  // Último fallback (não criptograficamente seguro, mas funciona)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
