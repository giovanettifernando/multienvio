import { Skeleton, Card, Tabs, Space, Row, Col } from 'antd';

export default function MinhaContaLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 150, marginBottom: 24 }} />

      <Card>
        {/* Tabs skeleton */}
        <Space style={{ marginBottom: 24 }}>
          <Skeleton.Button active style={{ width: 80 }} />
          <Skeleton.Button active style={{ width: 80 }} />
          <Skeleton.Button active style={{ width: 80 }} />
          <Skeleton.Button active style={{ width: 80 }} />
        </Space>

        {/* Content skeleton */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Skeleton.Input active style={{ width: '100%' }} />
              <Skeleton.Input active style={{ width: '100%' }} />
              <Skeleton.Input active style={{ width: '100%' }} />
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Skeleton.Input active style={{ width: '100%' }} />
              <Skeleton.Input active style={{ width: '100%' }} />
              <Skeleton.Input active style={{ width: '100%' }} />
            </Space>
          </Col>
        </Row>

        <Skeleton.Button active style={{ marginTop: 24 }} />
      </Card>
    </div>
  );
}
