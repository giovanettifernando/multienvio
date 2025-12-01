import { Skeleton, Card, Space } from 'antd';

export default function ColetasLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space style={{ width: '100%' }}>
            <Skeleton.Input active style={{ width: 250 }} />
            <Skeleton.Input active style={{ width: 120 }} />
          </Space>

          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Skeleton.Input active size="small" style={{ width: 80 }} />
              <Skeleton.Input active size="small" style={{ width: 100 }} />
              <Skeleton.Input active size="small" style={{ width: 150, flex: 1 }} />
              <Skeleton.Button active size="small" style={{ width: 80 }} />
              <Skeleton.Input active size="small" style={{ width: 100 }} />
              <Space>
                <Skeleton.Avatar active size="small" />
                <Skeleton.Avatar active size="small" />
              </Space>
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
}
