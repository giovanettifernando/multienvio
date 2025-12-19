import { ELTypography } from "@/shared/ui";
const Typography = ELTypography;
import { ELModal } from '@/shared/ui/ELModal';
import type { CartItem } from '@/shared/types/cart';

type RemoveItemModalProps = {
  open: boolean;
  item?: CartItem | null;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RemoveItemModal({
  open,
  item,
  confirmLoading,
  onConfirm,
  onCancel,
}: RemoveItemModalProps) {
  return (
    <ELModal
      size="sm"
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText="Remover"
      okButtonProps={{ danger: true }}
      cancelText="Cancelar"
      title="Remover item"
    >
      <Typography.Paragraph>
        Tem certeza que deseja remover{" "}
        <Typography.Text strong>
          {item?.transportadora} — {item?.modalidade}
        </Typography.Text>{" "}
        do carrinho?
      </Typography.Paragraph>
    </ELModal>
  );
}

export default RemoveItemModal;
