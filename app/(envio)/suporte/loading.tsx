import { Skeleton, Card, Space } from 'antd';

export default function SuporteLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 24 }}>
        <Skeleton.Input active style={{ width: 120 }} />
        <Skeleton.Button active />
      </Space>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Skeleton.Input active size="small" style={{ width: 60 }} />
              <Skeleton.Input active size="small" style={{ width: 200, flex: 1 }} />
              <Skeleton.Button active size="small" style={{ width: 80 }} />
              <Skeleton.Button active size="small" style={{ width: 60 }} />
              <Skeleton.Input active size="small" style={{ width: 100 }} />
              <Skeleton.Avatar active size="small" />
            </div>
          ))}
        </Space>
      </Card>
    </div>
  );
}
