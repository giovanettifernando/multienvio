"use client";

import { ConfigProvider, Segmented, theme } from "antd";

interface ReverseToggleProps {
  isReverse: boolean;
  onChange: (isReverse: boolean) => void;
  disabled?: boolean;
}

/**
 * Toggle between normal shipment and reverse logistics
 */
export function ReverseToggle({ isReverse, onChange, disabled }: ReverseToggleProps) {
  const { token } = theme.useToken();

  return (
    <ConfigProvider
      theme={{
        components: {
          Segmented: {
            itemSelectedBg: isReverse ? token.colorError : token.colorPrimary,
            itemSelectedColor: "#ffffff",
            itemColor: isReverse ? token.colorError : token.colorPrimary,
            trackBg: isReverse ? token.colorErrorBg : token.colorPrimaryBg,
          },
        },
      }}
    >
      <Segmented
        value={isReverse ? "reversa" : "envio"}
        onChange={(value) => onChange(value === "reversa")}
        disabled={disabled}
        options={[
          { label: "Envio", value: "envio" },
          { label: "Logística Reversa", value: "reversa" },
        ]}
        size="middle"
      />
    </ConfigProvider>
  );
}
