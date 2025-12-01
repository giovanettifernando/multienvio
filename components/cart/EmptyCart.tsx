import { Button, Result } from "antd";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/shared/PageShell";

export function EmptyCart() {
  const router = useRouter();

  return (
    <PageShell title="Carrinho" gap="md">
      <Result
        status="info"
        title="Seu carrinho está vazio"
        subTitle="Adicione cotações ao carrinho para finalizar seus envios."
        extra={
          <Button type="primary" onClick={() => router.push("/cotacoes")}>
            Cotar envio
          </Button>
        }
      />
    </PageShell>
  );
}

export default EmptyCart;
