import { Card, Skeleton } from "antd";

export default function PaymentLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    </div>
  );
}
