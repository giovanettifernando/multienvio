import { UndoOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";

type FlipCepsButtonsProps = {
  onLogisticReverse: () => void;
  reverseActive?: boolean;
  disabled?: boolean;
};

export function FlipCepsButtons({
  onLogisticReverse,
  reverseActive,
  disabled,
}: FlipCepsButtonsProps) {
  return (
    <Tooltip title="Alternar visualização para logística reversa">
      <Button
        type={reverseActive ? "primary" : "default"}
        icon={<UndoOutlined />}
        onClick={onLogisticReverse}
        disabled={disabled}
        aria-pressed={reverseActive}
      >
        Logística Reversa
      </Button>
    </Tooltip>
  );
}
