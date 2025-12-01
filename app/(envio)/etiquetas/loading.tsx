import { Skeleton, Card, Space, Row, Col } from 'antd';

export default function EtiquetasLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 150, marginBottom: 24 }} />

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ width: '100%' }}>
            <Skeleton.Input active style={{ width: 250 }} />
            <Skeleton.Input active style={{ width: 120 }} />
            <Skeleton.Button active />
          </Space>

          <Row gutter={[16, 16]}>
            {Array.from({ length: 6 }, (_, i) => (
              <Col key={i} xs={24} sm={12} md={8}>
                <Card size="small">
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </Card>
    </div>
  );
}
