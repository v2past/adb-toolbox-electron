import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Space, Tag, message } from 'antd';
import { PlayCircleOutlined, StopOutlined, ClearOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppStore } from '../store/appStore';

const LogsPage: React.FC = () => {
  const { selectedDeviceId, isLogStreaming, setIsLogStreaming, addOperation } = useAppStore();

  const [lines, setLines] = useState<string[]>([]);
  const [logStatus, setLogStatus] = useState<'started' | 'stopped'>('stopped');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // 自动滚动到底部
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines]);

  // 订阅日志消息与状态事件
  useEffect(() => {
    const handleMessage = (line: string) => {
      setLines((prev) => [...prev, line]);
    };
    const handleStatus = (status: 'started' | 'stopped') => {
      setLogStatus(status);
      setIsLogStreaming(status === 'started');
    };

    window.api?.onLogMessage(handleMessage);
    window.api?.onLogStatus(handleStatus);

    return () => {
      window.api?.offLogMessage(handleMessage);
      window.api?.offLogStatus(handleStatus);
      void window.api?.stopLogcat();
    };
  }, [setIsLogStreaming]);

  const handleStart = async () => {
    if (!selectedDeviceId) {
      message.warning('请先在“设备管理”页选择当前操作设备');
      return;
    }
    if (!window.api) {
      message.error('当前环境未注入 API，无法启动日志监控');
      return;
    }

    setStarting(true);
    try {
      const res = await window.api.startLogcat({ deviceId: selectedDeviceId, format: 'time' });
      if (res.ok) {
        message.success('已开始日志监控');
        addOperation({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'logcat-start',
          deviceId: selectedDeviceId,
          command: 'logcat',
          args: ['-v', 'time'],
          status: 'success',
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      } else {
        message.error(res.error?.message ?? '启动日志监控失败');
        addOperation({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'logcat-start',
          deviceId: selectedDeviceId,
          command: 'logcat',
          args: ['-v', 'time'],
          status: 'failed',
          error: `${res.error?.code ?? ''} ${res.error?.message ?? ''}`.trim(),
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      message.error(msg);
      addOperation({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'logcat-start',
        deviceId: selectedDeviceId,
        command: 'logcat',
        args: ['-v', 'time'],
        status: 'failed',
        error: msg,
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    if (!window.api) {
      message.error('当前环境未注入 API，无法停止日志监控');
      return;
    }

    setStopping(true);
    try {
      const res = await window.api.stopLogcat();
      if (res.ok) {
        message.success('日志监控已停止');
        addOperation({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'logcat-stop',
          deviceId: selectedDeviceId,
          command: 'logcat',
          args: [],
          status: 'success',
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      } else {
        message.error(res.error?.message ?? '停止日志监控失败');
        addOperation({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: 'logcat-stop',
          deviceId: selectedDeviceId,
          command: 'logcat',
          args: [],
          status: 'failed',
          error: `${res.error?.code ?? ''} ${res.error?.message ?? ''}`.trim(),
          createdAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      message.error(msg);
      addOperation({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'logcat-stop',
        deviceId: selectedDeviceId,
        command: 'logcat',
        args: [],
        status: 'failed',
        error: msg,
        createdAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
    } finally {
      setStopping(false);
    }
  };

  const handleClearScreen = () => {
    setLines([]);
  };

  const handleSaveLogs = async () => {
    if (!window.api) {
      message.error('当前环境未注入 API，无法保存日志');
      return;
    }

    setSaving(true);
    try {
      const res = await window.api.saveLogs({});
      if (res.ok) {
        if (res.data?.filePath) {
          message.success(`日志已保存至：${res.data.filePath}`);
        } else {
          message.info('当前没有可保存的日志内容');
        }
      } else {
        message.error(res.error?.message ?? '保存日志失败');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const effectiveStatus = isLogStreaming || logStatus === 'started' ? 'started' : 'stopped';

  return (
    <Card title="日志监控" bordered={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => void handleStart()}
            disabled={!selectedDeviceId || effectiveStatus === 'started'}
            loading={starting}
          >
            开始监控
          </Button>
          <Button
            icon={<StopOutlined />}
            onClick={() => void handleStop()}
            disabled={effectiveStatus !== 'started'}
            loading={stopping}
          >
            停止监控
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={handleClearScreen}
            disabled={lines.length === 0}
          >
            清空屏幕
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={() => void handleSaveLogs()}
            loading={saving}
          >
            保存当前缓冲到文件
          </Button>
          <span>
            当前状态：
            <Tag color={effectiveStatus === 'started' ? 'green' : 'default'}>
              {effectiveStatus === 'started' ? '监控中' : '未开始'}
            </Tag>
          </span>
        </Space>
        <div
          ref={containerRef}
          style={{
            height: 400,
            overflow: 'auto',
            background: '#000',
            color: '#0f0',
            padding: 8,
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: 12,
          }}
        >
          {lines.length === 0 ? (
            <span style={{ color: '#888' }}>暂无日志输出，点击“开始监控”以启动 logcat。</span>
          ) : (
            lines.map((line, index) => (
              <div key={index}>{line}</div>
            ))
          )}
        </div>
      </Space>
    </Card>
  );
};

export default LogsPage;
