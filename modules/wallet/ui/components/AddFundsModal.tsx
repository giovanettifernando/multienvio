"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PaymentModal } from "@/modules/payments/ui/components/PaymentModal";

export type AddFundsModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Modal para adicionar saldo à carteira.
 * Wrapper do PaymentModal em modo "topup".
 */
export function AddFundsModal({ open, onClose }: AddFundsModalProps) {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    // Invalidar query da carteira para atualizar saldo
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  return (
    <PaymentModal
      open={open}
      onClose={onClose}
      mode="topup"
      title="Adicionar saldo"
      description="Recarga de carteira"
      allowWallet={false}
      metadata={{
        type: "wallet_topup",
      }}
      onSuccess={handleSuccess}
    />
  );
}

export default AddFundsModal;
