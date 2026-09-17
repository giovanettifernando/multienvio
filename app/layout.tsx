import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ELConfigProvider, ELLocale } from '@/shared/ui';
const ConfigProvider = ELConfigProvider;
const ptBR = ELLocale.ptBR;
import { Inter } from "next/font/google";
import { AppProviders } from '@/shared/ui/providers/app-providers';
import { getThemeConfig } from "@/shared/ui/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Multienvio | Plataforma de envios inteligentes",
  description:
    "Multienvio: cotações de frete, geração de etiquetas e gestão completa de envios em um só lugar.",
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
