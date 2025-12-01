import { Skeleton, Card, Space, Row, Col } from 'antd';

export default function CotacoesLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 150, marginBottom: 24 }} />

      <Row gutter={[16, 16]}>
        {/* Form card */}
        <Col xs={24} lg={16}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Row gutter={16}>
                <Col span={12}>
                  <Skeleton.Input active style={{ width: '100%' }} />
                </Col>
                <Col span={12}>
                  <Skeleton.Input active style={{ width: '100%' }} />
                </Col>
              </Row>
              <Skeleton active paragraph={{ rows: 3 }} />
              <Skeleton.Button active block />
            </Space>
          </Card>
        </Col>

        {/* Results card */}
        <Col xs={24} lg={8}>
          <Card>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
