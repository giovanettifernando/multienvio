import { useState } from "react";
import {
  Button,
  Card,
  Divider,
  Flex,
  Radio,
  Space,
  Typography,
} from "antd";
import type { Cart } from "@/types/cart";
import type { CheckoutPayload } from "@/types/cart";

type PaymentMethod = CheckoutPayload["pagamento"]["metodo"];

type CartSummaryProps = {
  cart: Cart;
  isClearing?: boolean;
  isCheckingOut?: boolean;
  onClear: () => void;
  onCheckout: (method: PaymentMethod) => void;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PAYMENT_OPTIONS: Array<{
  label: string;
  value: PaymentMethod;
}> = [
  { label: "Saldo em carteira", value: "WALLET" },
  { label: "PIX", value: "PIX" },
  { label: "Cartão de crédito", value: "CARD" },
  { label: "Boleto", value: "BOLETO" },
];

export function CartSummary({
  cart,
  isClearing,
  isCheckingOut,
  onClear,
  onCheckout,
}: CartSummaryProps) {
  const [payment, setPayment] = useState<PaymentMethod>("WALLET");

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

        <div>
          <Typography.Text strong style={{ display: "block" }}>
            Método de pagamento
          </Typography.Text>
          <Radio.Group
            value={payment}
            onChange={(event) =>
              setPayment(event.target.value as PaymentMethod)
            }
            style={{ marginTop: 8 }}
          >
            <Space direction="vertical">
              {PAYMENT_OPTIONS.map((option) => (
                <Radio key={option.value} value={option.value}>
                  {option.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>

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
            onClick={() => onCheckout(payment)}
            loading={isCheckingOut}
            disabled={cart.items.length === 0}
          >
            Finalizar compra
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

export default CartSummary;
