import { Skeleton, Card, Row, Col, Space } from 'antd';

export default function EnvioLoading() {
  return (
    <div style={{ padding: '24px' }}>
      {/* Header skeleton */}
      <Skeleton.Input active style={{ width: 200, marginBottom: 24 }} />

      {/* Cards grid skeleton */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        </Col>
      </Row>

      {/* Table skeleton */}
      <Card style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Skeleton.Input active style={{ width: '100%' }} />
          <Skeleton active paragraph={{ rows: 5 }} />
        </Space>
      </Card>
    </div>
  );
}
