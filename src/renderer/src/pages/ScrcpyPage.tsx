import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Select,
  InputNumber,
  Switch,
  Typography,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  MobileOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store/appStore';
import type { ScrcpyStartOptions, ScrcpyStatus } from '@shared/types/models';

const { Title, Text } = Typography;

const ScrcpyPage: React.FC = () => {
  const { devices, selectedDeviceId, setSelectedDeviceId } = useAppStore();
  const [scrcpyStatus, setScrcpyStatus] = useState<ScrcpyStatus>({ running: false });
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const [windowWidth, setWindowWidth] = useState<number>(1920);
  const [windowHeight, setWindowHeight] = useState<number>(1080);
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(true);
  const [noBorder, setNoBorder] = useState<boolean>(false);
  const [stayAwake, setStayAwake] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      if (window.api) {
        const res = await window.api.getScrcpyStatus();
        if (res.ok && res.data) {
          setScrcpyStatus(res.data);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStartScrcpy = async () => {
    if (!selectedDeviceId) {
      message.warning('请先选择设备');
      return;
    }

    setStarting(true);
    try {
      const options: ScrcpyStartOptions = {
        deviceId: selectedDeviceId,
        windowTitle: `Scrcpy - ${selectedDeviceId}`,
        windowWidth,
        windowHeight,
        alwaysOnTop,
        noBorder,
        stayAwake,
      };

      if (window.api) {
        const res = await window.api.startScrcpy(options);
        if (res.ok) {
          message.success('Scrcpy 投屏已启动');
          const statusRes = await window.api.getScrcpyStatus();
          if (statusRes.ok && statusRes.data) {
            setScrcpyStatus(statusRes.data);
          }
        } else {
          message.error(`启动失败: ${res.error?.message || '未知错误'}`);
        }
      }
    } catch (error) {
      message.error('启动 Scrcpy 时发生错误');
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const handleStopScrcpy = async () => {
    setStopping(true);
    try {
      if (window.api) {
        const res = await window.api.stopScrcpy();
        if (res.ok) {
          message.success('Scrcpy 投屏已停止');
          setScrcpyStatus({ running: false });
        } else {
          message.error(`停止失败: ${res.error?.message || '未知错误'}`);
        }
      }
    } catch (error) {
      message.error('停止 Scrcpy 时发生错误');
      console.error(error);
    } finally {
      setStopping(false);
    }
  };

  const deviceOptions = devices.map((device) => ({
    label: `${device.id} ${device.model ? `(${device.model})` : ''}`,
    value: device.id,
  }));

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <MobileOutlined /> 虚拟投屏
      </Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="设备选择" extra={<MobileOutlined />}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>选择设备：</Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                placeholder="请选择要投屏的设备"
                value={selectedDeviceId}
                onChange={setSelectedDeviceId}
                options={deviceOptions}
                loading={loading}
              />
            </div>
          </Space>
        </Card>

        <Card title="投屏设置" extra={<SettingOutlined />}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <div>
                <Text strong>窗口宽度：</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  min={320}
                  max={7680}
                  step={100}
                  value={windowWidth}
                  onChange={(value) => setWindowWidth(value || 1920)}
                />
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div>
                <Text strong>窗口高度：</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 8 }}
                  min={240}
                  max={4320}
                  step={100}
                  value={windowHeight}
                  onChange={(value) => setWindowHeight(value || 1080)}
                />
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div>
                <Text strong>置顶窗口：</Text>
                <div style={{ marginTop: 8 }}>
                  <Switch
                    checked={alwaysOnTop}
                    onChange={setAlwaysOnTop}
                  />
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div>
                <Text strong>无边框模式：</Text>
                <div style={{ marginTop: 8 }}>
                  <Switch
                    checked={noBorder}
                    onChange={setNoBorder}
                  />
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div>
                <Text strong>保持唤醒：</Text>
                <div style={{ marginTop: 8 }}>
                  <Switch
                    checked={stayAwake}
                    onChange={setStayAwake}
                  />
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <Card title="投屏控制">
          <Space size="large">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartScrcpy}
              loading={starting}
              disabled={scrcpyStatus.running || !selectedDeviceId}
              size="large"
            >
              启动投屏
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStopScrcpy}
              loading={stopping}
              disabled={!scrcpyStatus.running}
              size="large"
            >
              停止投屏
            </Button>
          </Space>

          {scrcpyStatus.running && (
            <Alert
              message="投屏运行中"
              description={
                <div>
                  <div>设备 ID: {scrcpyStatus.deviceId || '未知'}</div>
                  <div>进程 PID: {scrcpyStatus.pid || '未知'}</div>
                </div>
              }
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        <Card title="使用说明">
          <Space direction="vertical">
            <Text>
              1. 确保设备已通过 ADB 连接并在设备管理中选择设备
            </Text>
            <Text>
              2. 配置投屏窗口的参数（宽度、高度、置顶等）
            </Text>
            <Text>
              3. 点击"启动投屏"按钮开始投屏
            </Text>
            <Text>
              4. 投屏窗口将显示设备屏幕，支持鼠标和键盘操作
            </Text>
            <Text type="secondary">
              注意：首次使用可能需要授权设备 USB 调试权限
            </Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default ScrcpyPage;
