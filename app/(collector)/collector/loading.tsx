import { Skeleton, Card, Row, Col, Space } from 'antd';

export default function CollectorLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <Col key={i} xs={24} sm={8}>
            <Card>
              <Skeleton active paragraph={{ rows: 1 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Coletas pendentes */}
      <Card>
        <Skeleton.Input active style={{ width: 150, marginBottom: 16 }} />
        <Space direction="vertical" style={{ width: '100%' }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} size="small">
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </Space>
      </Card>
    </div>
  );
}
