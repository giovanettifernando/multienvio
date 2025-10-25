import { SwapOutlined, UndoOutlined } from "@ant-design/icons";
import { Button, Space, Tooltip } from "antd";

type FlipCepsButtonsProps = {
  onInvert: () => void;
  onLogisticReverse: () => void;
  reverseActive?: boolean;
  disabled?: boolean;
};

export function FlipCepsButtons({
  onInvert,
  onLogisticReverse,
  reverseActive,
  disabled,
}: FlipCepsButtonsProps) {
  return (
    <Space size={8} wrap>
      <Tooltip title="Trocar CEP de origem e destino">
        <Button
          icon={<SwapOutlined />}
          onClick={onInvert}
          disabled={disabled}
        >
          Inverter
        </Button>
      </Tooltip>
      <Tooltip title="Ativar logística reversa para devoluções">
        <Button
          type={reverseActive ? "primary" : "default"}
          icon={<UndoOutlined />}
          onClick={onLogisticReverse}
          disabled={disabled}
        >
          Logística Reversa
        </Button>
      </Tooltip>
    </Space>
  );
}
