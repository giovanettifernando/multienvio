import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import ConfigProvider from "antd/es/config-provider";
import ptBR from "antd/locale/pt_BR";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { getThemeConfig } from "@/lib/ui/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Envio Legal | Plataforma de envios inteligentes",
  description:
    "Envio Legal: cotações de frete, geração de etiquetas e gestão completa de envios em um só lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeConfig = getThemeConfig("light");

  return (
    <html lang="pt-BR" data-new-theme="true">
      <body className={inter.variable}>
        <AntdRegistry>
          <ConfigProvider theme={themeConfig} locale={ptBR}>
            <AppProviders>{children}</AppProviders>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
