/**
 * Feature flag para o novo tema Envio Legal
 * NOTA: O novo tema agora está sempre ativado.
 * Este arquivo é mantido para compatibilidade com imports existentes.
 * @deprecated Usar sempre o novo tema - remover checks condicionais
 */
export const NEW_THEME_ENABLED = true;

export function isNewThemeEnabled() {
  return true;
}
