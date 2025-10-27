export const NEW_THEME_ENABLED =
  process.env.NEXT_PUBLIC_NEW_THEME === "true";

export function isNewThemeEnabled() {
  return NEW_THEME_ENABLED;
}
