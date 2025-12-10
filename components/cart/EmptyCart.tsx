import { useRouter } from "next/navigation";
import { PageShell } from "@/components/shared/PageShell";
import { ELEmpty } from "@/components/ui/ELEmpty";

export function EmptyCart() {
  const router = useRouter();

  return (
    <PageShell title="Carrinho" gap="md">
      <ELEmpty
        title="Seu carrinho está vazio"
        description="Adicione cotações ao carrinho para finalizar seus envios."
        primaryAction={{
          label: "Cotar envio",
          onClick: () => router.push("/cotacoes"),
        }}
      />
    </PageShell>
  );
}

export default EmptyCart;
