import { useSyncExternalStore } from 'react';

/**
 * Hook para detectar se o componente está hidratado (cliente).
 * Usa useSyncExternalStore para evitar warnings do React Compiler.
 *
 * @returns true se está no cliente após hidratação, false durante SSR/SSG
 */
export function useHydration(): boolean {
  return useSyncExternalStore(
    // subscribe - não precisa fazer nada pois o estado nunca muda
    () => () => {},
    // getSnapshot (cliente)
    () => true,
    // getServerSnapshot (servidor)
    () => false
  );
}
