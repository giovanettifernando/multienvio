import { Button, Result, Typography } from "antd";
import { useRouter } from "next/navigation";

export function EmptyCart() {
  const router = useRouter();

  return (
    <Result
      status="info"
      title="Seu carrinho está vazio"
      subTitle="Adicione cotações ao carrinho para finalizar seus envios."
      extra={
        <Button type="primary" onClick={() => router.push("/cotacoes")}>
          Cotar envio
        </Button>
      }
    >
      <Typography.Paragraph style={{ marginTop: 16 }}>
        Precisa de ajuda? Fale com nosso suporte para importar pedidos em massa
        ou configurar integrações.
      </Typography.Paragraph>
    </Result>
  );
}

export default EmptyCart;
