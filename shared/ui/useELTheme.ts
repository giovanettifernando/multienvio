/**
 * useELTheme - Design System hook for accessing AntD theme tokens
 *
 * Wraps AntD's theme.useToken() to provide consistent access to theme tokens
 * across the application without importing directly from 'antd'.
 */
import { theme } from 'antd';

/**
 * Hook to access AntD theme tokens
 * @returns Object with token containing all AntD design tokens
 */
export function useELTheme() {
  return theme.useToken();
}
