import { Suspense } from "react";
import { connection } from "next/server";
import PaymentPageClient from "./PaymentPageClient";

export const metadata = {
  title: "Pagar Frete - Multienvio",
  description: "Efetue o pagamento do frete do seu envio",
};

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            background: "#f5f5f5",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #f3f3f3",
              borderTop: "3px solid #1890ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <PaymentPageClient token={token} />
    </Suspense>
  );
}
