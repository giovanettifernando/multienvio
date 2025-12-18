/**
 * Hook to get antd message API from App context
 *
 * This is the recommended way to use message in antd 5/6+ to ensure
 * messages respect ConfigProvider theme and work correctly with
 * React's concurrent features.
 *
 * Usage:
 * ```tsx
 * import { useAppMessage } from '@/lib/ui/useAppMessage';
 *
 * function MyComponent() {
 *   const message = useAppMessage();
 *   message.success('Operation completed');
 * }
 * ```
 */
import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
// Note: MessageInstance is not directly exported from 'antd', so we keep the /es/ import for this type

export function useAppMessage(): MessageInstance {
  const { message } = App.useApp();
  return message;
}

export type { MessageInstance };
