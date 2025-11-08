import {
  Button,
  Card,
  Divider,
  Flex,
  Space,
  Typography,
} from "antd";
import type { Cart } from "@/types/cart";

type CartSummaryProps = {
  cart: Cart;
  isClearing?: boolean;
  onClear: () => void;
  onCheckout: () => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function CartSummary({
  cart,
  isClearing,
  onClear,
  onCheckout,
}: CartSummaryProps) {

  return (
    <Card title="Resumo do carrinho" styles={{ body: { paddingTop: 16 } }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Flex justify="space-between">
          <Typography.Text>Subtotal</Typography.Text>
          <Typography.Text strong>
            {currencyFormatter.format(cart.subtotal)}
          </Typography.Text>
        </Flex>
        <Flex justify="space-between">
          <Typography.Text>Descontos</Typography.Text>
          <Typography.Text strong>
            {currencyFormatter.format(cart.descontos)}
          </Typography.Text>
        </Flex>
        <Flex justify="space-between">
          <Typography.Text>Taxas</Typography.Text>
          <Typography.Text strong>
            {currencyFormatter.format(cart.taxas)}
          </Typography.Text>
        </Flex>
        <Divider style={{ margin: "12px 0" }} />
        <Flex justify="space-between">
          <Typography.Text strong>Total</Typography.Text>
          <Typography.Title
            level={3}
            style={{ margin: 0, fontSize: 20, lineHeight: 1 }}
          >
            {currencyFormatter.format(cart.total)}
          </Typography.Title>
        </Flex>

        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Button
            type="default"
            danger
            onClick={onClear}
            disabled={cart.items.length === 0}
            loading={isClearing}
          >
            Limpar carrinho
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={onCheckout}
            disabled={cart.items.length === 0}
          >
            Finalizar pagamento
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

export default CartSummary;
