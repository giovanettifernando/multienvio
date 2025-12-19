"use client";

import { ELFlowModeToggle } from '@/shared/ui';

interface ReverseToggleProps {
  isReverse: boolean;
  onChange: (isReverse: boolean) => void;
  disabled?: boolean;
}

/**
 * Toggle between normal shipment and reverse logistics.
 * Wrapper para ELFlowModeToggle mantendo a interface existente.
 */
export function ReverseToggle({ isReverse, onChange, disabled }: ReverseToggleProps) {
  return (
    <ELFlowModeToggle
      isReverse={isReverse}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
