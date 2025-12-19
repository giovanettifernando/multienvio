import { ELConfigProvider, ELApp } from "@/shared/ui";

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ELConfigProvider>
      <ELApp>{children}</ELApp>
    </ELConfigProvider>
  );
}
