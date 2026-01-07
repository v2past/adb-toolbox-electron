import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Table, Switch, Alert, Space, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppStore } from '../store/appStore';
import type { ADBDevice } from '@shared/types/models';

const columns: ColumnsType<ADBDevice> = [
  { title: '设备 ID', dataIndex: 'id', key: 'id' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '型号', dataIndex: 'model', key: 'model' },
  { title: '产品', dataIndex: 'product', key: 'product' },
];

const DevicesPage: React.FC = () => {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    isDevicePolling,
    setIsDevicePolling,
    settings,
    setDevices,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await window.api?.getDevices();
      if (res?.ok && res.data) {
        setDevices(res.data);
        setErrorMessage(null);

        if (selectedDeviceId && !res.data.some((device) => device.id === selectedDeviceId)) {
          setSelectedDeviceId(undefined);
        }
      } else if (res && !res.ok) {
        setErrorMessage(res.error?.message ?? '获取设备列表失败');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, setDevices, setSelectedDeviceId]);

  // 首次进入页面时主动刷新一次列表
  useEffect(() => {
    if (!devices.length) {
      void fetchDevices();
    }
  }, [devices.length, fetchDevices]);

  // 根据开关和设置中的轮询间隔定时刷新设备列表
  useEffect(() => {
    if (!isDevicePolling) {
      return undefined;
    }

    const rawInterval = settings.devicePollIntervalMs || 5000;
    const intervalMs = Math.min(Math.max(rawInterval, 500), 60000);

    // 打开轮询时先执行一次，避免首次等待完整间隔
    void fetchDevices();

    const timer = setInterval(() => {
      void fetchDevices();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [isDevicePolling, settings.devicePollIntervalMs, fetchDevices]);

  const deviceSummary = useMemo(() => {
    const total = devices.length;
    const unauthorized = devices.filter((d) => d.status === 'unauthorized').length;
    const offline = devices.filter((d) => d.status === 'offline').length;

    if (!total) {
      return '当前未检测到已连接的设备，请检查 USB 连接或 ADB 配置。';
    }

    const parts: string[] = [`已连接 ${total} 台设备`];
    if (unauthorized) {
      parts.push(`${unauthorized} 台设备未授权`);
    }
    if (offline) {
      parts.push(`${offline} 台设备离线`);
    }
    return parts.join('，');
  }, [devices]);

  return (
    <Card
      title="设备管理"
      bordered={false}
      extra={
        <Space size="middle">
          <span>设备轮询</span>
          <Switch
            checked={isDevicePolling}
            onChange={(checked) => setIsDevicePolling(checked)}
          />
          <Button size="small" onClick={() => void fetchDevices()} loading={loading}>
            手动刷新
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            message="设备状态异常"
            description={errorMessage}
          />
        ) : (
          <Alert
            type={devices.length ? 'success' : 'info'}
            showIcon
            message={deviceSummary}
          />
        )}

        <Table<ADBDevice>
          rowKey="id"
          columns={columns}
          dataSource={devices}
          pagination={false}
          loading={loading}
          rowSelection={{
            type: 'radio',
            selectedRowKeys: selectedDeviceId ? [selectedDeviceId] : [],
            onChange: (keys) => {
              const id = keys[0] as string | undefined;
              setSelectedDeviceId(id);
            },
          }}
        />
      </Space>
    </Card>
  );
};

export default DevicesPage;
