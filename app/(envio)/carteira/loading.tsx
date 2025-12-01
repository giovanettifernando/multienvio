import { Skeleton, Card, Row, Col, Space } from 'antd';

export default function CarteiraLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 120, marginBottom: 24 }} />

      <Row gutter={[16, 16]}>
        {/* Saldo card */}
        <Col xs={24} md={8}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Skeleton.Input active style={{ width: 80 }} size="small" />
              <Skeleton.Input active style={{ width: 150, height: 40 }} />
              <Space>
                <Skeleton.Button active size="small" />
                <Skeleton.Button active size="small" />
              </Space>
            </Space>
          </Card>
        </Col>

        {/* Transações recentes */}
        <Col xs={24} md={16}>
          <Card>
            <Skeleton.Input active style={{ width: 150, marginBottom: 16 }} />
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
