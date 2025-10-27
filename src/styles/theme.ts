import type { ThemeConfig } from "antd";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

type ThemeMode = "light" | "dark";

type VisualTokens = {
  colorPrimary: string;
  colorInfo: string;
  colorWarning: string;
  colorSuccess: string;
  colorError: string;
  fontSize: number;
  borderRadius: number;
  boxShadow: string;
  spacing: typeof spacing;
};

const lightTokens: VisualTokens = {
  colorPrimary: "#003873",
  colorInfo: "#003873",
  colorWarning: "#E4660C",
  colorSuccess: "#1E8E5A",
  colorError: "#D64545",
  fontSize: 16,
  borderRadius: 12,
  boxShadow: "0 20px 48px rgba(0, 56, 115, 0.12)",
  spacing,
};

const darkTokens: VisualTokens = {
  colorPrimary: "#7CB4FF",
  colorInfo: "#7CB4FF",
  colorWarning: "#F89B4D",
  colorSuccess: "#3CD57A",
  colorError: "#FF7B83",
  fontSize: 16,
  borderRadius: 12,
  boxShadow: "0 20px 48px rgba(12, 27, 49, 0.6)",
  spacing,
};

const legacyTheme: ThemeConfig = {
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

const sharedComponentTokens: ThemeConfig["components"] = {
  Button: {
    controlHeight: 44,
    paddingInline: 20,
    borderRadius: lightTokens.borderRadius,
    fontWeight: 600,
    boxShadow: "none",
    primaryShadow: "none",
  },
  Card: {
    borderRadiusLG: lightTokens.borderRadius + 4,
    paddingLG: spacing.lg,
    padding: spacing.lg,
    boxShadow: lightTokens.boxShadow,
    headerPadding: spacing.lg,
  },
  Form: {
    itemMarginBottom: spacing.lg,
    verticalLabelPadding: `${spacing.xs}px 0 ${spacing.xs / 2}px`,
  },
  Input: {
    borderRadius: lightTokens.borderRadius / 1.5,
    controlHeight: 44,
    paddingInline: spacing.sm,
  },
  Select: {
    borderRadius: lightTokens.borderRadius / 1.5,
    controlHeight: 44,
    optionPadding: `${spacing.xs}px ${spacing.sm}px`,
  },
  Tag: {
    borderRadiusSM: lightTokens.borderRadius / 2,
    defaultBg: "#EAF1F9",
    defaultColor: "#1E3450",
  },
  Skeleton: {
    color: "rgba(0, 56, 115, 0.08)",
  },
};

const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: lightTokens.colorPrimary,
    colorInfo: lightTokens.colorInfo,
    colorWarning: lightTokens.colorWarning,
    colorSuccess: lightTokens.colorSuccess,
    colorError: lightTokens.colorError,
    colorBgBase: "#F7F8FA",
    colorBgLayout: "#F7F8FA",
    colorBgContainer: "#FFFFFF",
    colorText: "#182235",
    colorTextSecondary: "#4A6076",
    colorBorder: "#CFD8E6",
    colorBorderSecondary: "#E5EBF4",
    fontSize: lightTokens.fontSize,
    borderRadius: lightTokens.borderRadius,
    boxShadowSecondary: lightTokens.boxShadow,
    controlHeight: 44,
  },
  components: sharedComponentTokens,
};

const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: darkTokens.colorPrimary,
    colorInfo: darkTokens.colorInfo,
    colorWarning: darkTokens.colorWarning,
    colorSuccess: darkTokens.colorSuccess,
    colorError: darkTokens.colorError,
    colorBgBase: "#0D141E",
    colorBgLayout: "#0D141E",
    colorBgContainer: "#162032",
    colorText: "#F5F8FF",
    colorTextSecondary: "#B5C2D6",
    colorBorder: "#223149",
    colorBorderSecondary: "#1C273C",
    fontSize: darkTokens.fontSize,
    borderRadius: darkTokens.borderRadius,
    boxShadowSecondary: darkTokens.boxShadow,
    controlHeight: 44,
  },
  components: sharedComponentTokens,
};

export const themeTokens: Record<ThemeMode, VisualTokens> = {
  light: lightTokens,
  dark: darkTokens,
};

export function getThemeConfig(
  enabled: boolean,
  mode: ThemeMode = "light",
): ThemeConfig {
  if (!enabled) {
    return legacyTheme;
  }

  return mode === "dark" ? darkTheme : lightTheme;
}
