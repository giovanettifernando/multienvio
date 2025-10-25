import { Modal, Typography } from "antd";
import type { CartItem } from "@/types/cart";

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
    <Modal
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
    </Modal>
  );
}

export default RemoveItemModal;
