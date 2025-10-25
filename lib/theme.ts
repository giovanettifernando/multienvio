import type { ThemeConfig } from "antd";

export const envioLegalTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0b3b73",
    colorInfo: "#0b3b73",
    colorSuccess: "#2c9b5c",
    colorWarning: "#f59e0b",
    colorError: "#d64545",
    fontFamily: "var(--font-inter, 'Inter', 'Segoe UI', sans-serif)",
    borderRadius: 8,
    colorBgLayout: "var(--color-background)",
  },
  components: {
    Button: {
      controlHeight: 40,
      paddingInline: 18,
      borderRadius: 8,
    },
    Layout: {
      headerBg: "#0b3b73",
      headerHeight: 64,
      siderBg: "#0f477f",
    },
    Menu: {
      itemBorderRadius: 6,
      itemMarginInline: 8,
      itemMarginBlock: 6,
      itemSelectedColor: "#0b3b73",
      itemSelectedBg: "#e6f0fb",
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
    },
    Table: {
      borderRadiusLG: 12,
      headerBg: "#f4f6fb",
    },
  },
};
