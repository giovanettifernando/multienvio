import { Skeleton, Card, Space } from 'antd';

export default function ShipmentsLoading() {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Input active style={{ width: 200, marginBottom: 24 }} />

      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Filters skeleton */}
          <Space style={{ width: '100%' }}>
            <Skeleton.Input active style={{ width: 300 }} />
            <Skeleton.Input active style={{ width: 150 }} />
            <Skeleton.Button active />
          </Space>

          {/* Table rows skeleton */}
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Skeleton.Input active size="small" style={{ width: 100 }} />
              <Skeleton.Input active size="small" style={{ width: 150, flex: 1 }} />
              <Skeleton.Input active size="small" style={{ width: 100 }} />
              <Skeleton.Button active size="small" style={{ width: 100 }} />
              <Skeleton.Input active size="small" style={{ width: 80 }} />
              <Skeleton.Input active size="small" style={{ width: 80 }} />
              <Space>
                <Skeleton.Avatar active size="small" />
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
