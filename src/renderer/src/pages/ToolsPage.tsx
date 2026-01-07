import React, { useMemo, useState } from 'react';
import {
  Card,
  Alert,
  Button,
  Space,
  message,
  Upload,
  Checkbox,
  Input,
  List,
  Typography,
} from 'antd';
import { UploadOutlined, PoweroffOutlined, HomeOutlined, RollbackOutlined, ClockCircleOutlined, DisconnectOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useAppStore } from '../store/appStore';
import type { ExecuteAdbCommandPayload, ExecuteAdbResult } from '@main/services/adbService';
import type { Operation } from '@shared/types/models';

const { Text, Paragraph } = Typography;

function isSecurityErrorCode(code?: string): boolean {
  if (!code) return false;
  return (
    code === 'ADB_BLACKLIST_HIT' ||
    code === 'ADB_SHELL_OPERATOR_FORBIDDEN' ||
    code === 'ADB_DANGEROUS_REBOOT'
  );
}

function createOperation(
  type: Operation['type'],
  status: Operation['status'],
  payload: {
    deviceId?: string;
    command?: string;
    args?: string[];
    output?: string;
    error?: string;
  },
): Operation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    deviceId: payload.deviceId,
    command: payload.command,
    args: payload.args,
    status,
    output: payload.output,
    error: payload.error,
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

function parsePackages(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith('package:') ? line.slice('package:'.length).trim() : line,
    );
}

const ToolsPage: React.FC = () => {
  const { selectedDeviceId, addOperation } = useAppStore();

  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);

  const [apkFilePath, setApkFilePath] = useState<string | undefined>();
  const [apkFileName, setApkFileName] = useState('');
  const [overwriteInstall, setOverwriteInstall] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [uninstallPackage, setUninstallPackage] = useState('');
  const [uninstalling, setUninstalling] = useState(false);

  const [packages, setPackages] = useState<string[]>([]);
  const [packageFilter, setPackageFilter] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(false);

  const [shellCommand, setShellCommand] = useState('');
  const [shellResult, setShellResult] = useState<{ stdout: string; stderr: string }>({
    stdout: '',
    stderr: '',
  });
  const [shellRunning, setShellRunning] = useState(false);

  const [securityAlert, setSecurityAlert] = useState<string | null>(null);

  const filteredPackages = useMemo(() => {
    if (!packageFilter.trim()) return packages;
    const keyword = packageFilter.trim().toLowerCase();
    return packages.filter((name) => name.toLowerCase().includes(keyword));
  }, [packageFilter, packages]);

  const ensureDeviceSelected = (): string | null => {
    if (!selectedDeviceId) {
      message.warning('请先在“设备管理”页选择当前操作设备');
      return null;
    }
    return selectedDeviceId;
  };

  const runAdbCommand = async (
    payload: ExecuteAdbCommandPayload,
    options: {
      operationType: Operation['type'];
      successMessage?: string;
      customSecurityMessagePrefix?: string;
    },
  ): Promise<ExecuteAdbResult | undefined> => {
    if (!window.api) {
      message.error('当前环境未注入 API，无法执行 ADB 命令');
      return undefined;
    }

    try {
      const res = await window.api.executeAdbCommand(payload);
      if (res.ok && res.data) {
        if (options.successMessage) {
          message.success(options.successMessage);
        }
        addOperation(
          createOperation(options.operationType, 'success', {
            deviceId: payload.deviceId,
            command: payload.command,
            args: payload.args,
            output: res.data.stdout || res.data.filePath,
            error: res.data.stderr || undefined,
          }),
        );
        return res.data;
      }

      const code = res.error?.code;
      const msg = res.error?.message ?? 'ADB 命令执行失败';
      message.error(msg);

      if (isSecurityErrorCode(code)) {
        setSecurityAlert(
          `${
            options.customSecurityMessagePrefix ?? '出于安全考虑，部分 shell 命令已被拦截。'
          }\n错误代码：${code}\n${msg}`,
        );
      }

      addOperation(
        createOperation(options.operationType, 'failed', {
          deviceId: payload.deviceId,
          command: payload.command,
          args: payload.args,
          error: `${code ?? ''} ${msg}`.trim(),
          output: res.error?.details ? JSON.stringify(res.error.details) : undefined,
        }),
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      message.error(msg);
      addOperation(
        createOperation(options.operationType, 'failed', {
          deviceId: payload.deviceId,
          command: payload.command,
          args: payload.args,
          error: msg,
        }),
      );
    }

    return undefined;
  };

  const handleKeyEvent = async (key: 'power' | 'home' | 'back') => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    await runAdbCommand(
      { deviceId, command: 'keyevent', args: [key] },
      {
        operationType: 'adb-command',
        successMessage: `按键 ${key} 已发送`,
      },
    );
  };

  const handleReboot = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    await runAdbCommand(
      { deviceId, command: 'reboot' },
      {
        operationType: 'adb-command',
        successMessage: '重启命令已发送，请稍候等待设备重启。',
      },
    );
  };

  const handleSyncTime = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    await runAdbCommand(
      { deviceId, command: 'sync-time' },
      {
        operationType: 'adb-command',
        successMessage: '设备时间已同步为当前时间',
      },
    );
  };

  const handleRemount = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    await runAdbCommand(
      { deviceId, command: 'remount' },
      {
        operationType: 'adb-command',
        successMessage: '已执行 adb root 和 adb remount',
      },
    );
  };

  const handleScreencap = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    setScreenshotError(null);
    setScreenshotPath(null);
    setScreenshotLoading(true);
    try {
      const result = await runAdbCommand(
        { deviceId, command: 'screencap' },
        {
          operationType: 'adb-command',
          successMessage: '截图成功',
        },
      );
      if (result?.filePath) {
        setScreenshotPath(result.filePath);
      } else if (result) {
        setScreenshotError('主进程未返回截图文件路径');
      }
    } finally {
      setScreenshotLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.apk',
    showUploadList: false,
    beforeUpload: (file) => {
      const anyFile = file as any;
      const filePath: string | undefined = anyFile?.path;
      if (!filePath) {
        message.error('无法获取 APK 文件路径，请在打包后的应用中使用此功能。');
        setApkFilePath(undefined);
        setApkFileName('');
        return false;
      }
      setApkFilePath(filePath);
      setApkFileName(file.name);
      return false;
    },
  };

  const handleInstallApk = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;
    if (!apkFilePath) {
      message.warning('请先选择要安装的 APK 文件');
      return;
    }

    setInstalling(true);
    try {
      await runAdbCommand(
        {
          deviceId,
          command: 'install',
          args: [apkFilePath],
          options: { reinstall: overwriteInstall },
        },
        {
          operationType: 'adb-command',
          successMessage: 'APK 安装命令已执行，请在设备上确认结果。',
        },
      );
    } finally {
      setInstalling(false);
    }
  };

  const handleUninstallApk = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;
    const pkg = uninstallPackage.trim();
    if (!pkg) {
      message.warning('请先输入要卸载的包名');
      return;
    }

    setUninstalling(true);
    try {
      await runAdbCommand(
        {
          deviceId,
          command: 'uninstall',
          args: [pkg],
        },
        {
          operationType: 'adb-command',
          successMessage: `已尝试卸载 ${pkg}`,
        },
      );
    } finally {
      setUninstalling(false);
    }
  };

  const handleLoadPackages = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    setLoadingPackages(true);
    try {
      const result = await runAdbCommand(
        {
          deviceId,
          command: 'list-packages',
        },
        {
          operationType: 'adb-command',
          successMessage: '已获取已安装应用列表',
        },
      );
      if (result) {
        setPackages(parsePackages(result.stdout));
      }
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleExecuteShell = async () => {
    const deviceId = ensureDeviceSelected();
    if (!deviceId) return;

    const trimmed = shellCommand.replace(/\r?\n/g, ' ').trim();
    if (!trimmed) {
      message.warning('请输入要执行的 shell 命令');
      return;
    }
    const args = trimmed.split(/\s+/);

    setShellRunning(true);
    setSecurityAlert(null);
    try {
      const result = await runAdbCommand(
        {
          deviceId,
          command: 'shell',
          args,
        },
        {
          operationType: 'custom-shell',
          customSecurityMessagePrefix:
            '检测到命令中包含管道、重定向或高危关键字，已被安全策略拦截。',
        },
      );
      if (result) {
        setShellResult({ stdout: result.stdout, stderr: result.stderr });
      }
    } finally {
      setShellRunning(false);
    }
  };

  const renderScreenshotPreview = () => {
    if (screenshotError) {
      return <Alert type="error" message={screenshotError} showIcon />;
    }

    if (!screenshotPath) {
      return <Text type="secondary">暂无截图，可点击上方按钮进行截图。</Text>;
    }

    const src = `file://${screenshotPath}`;

    return (
      <div style={{ border: '1px solid #f0f0f0', padding: 8, borderRadius: 4 }}>
        <img
          src={src}
          alt="设备截图"
          style={{ maxWidth: '100%', maxHeight: 320, display: 'block' }}
          onError={() => {
            setScreenshotError('截图预览加载失败，请检查文件是否仍然存在。');
          }}
        />
        <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          源文件：{screenshotPath}
        </Text>
      </div>
    );
  };

  return (
    <Card title="工具箱" bordered={false}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {securityAlert && (
          <Alert
            type="warning"
            showIcon
            closable
            onClose={() => setSecurityAlert(null)}
            message="安全提示"
            description={securityAlert}
          />
        )}

        {/* 常用命令：模拟按键、重启 */}
        <Card type="inner" title="常用命令">
          <Space size="middle" wrap>
            <Button
              icon={<PoweroffOutlined />}
              onClick={() => void handleKeyEvent('power')}
              disabled={!selectedDeviceId}
            >
              电源键
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => void handleKeyEvent('back')}
              disabled={!selectedDeviceId}
            >
              返回键
            </Button>
            <Button
              icon={<HomeOutlined />}
              onClick={() => void handleKeyEvent('home')}
              disabled={!selectedDeviceId}
            >
              Home 键
            </Button>
            <Button
              icon={<ClockCircleOutlined />}
              onClick={() => void handleSyncTime()}
              disabled={!selectedDeviceId}
            >
              同步时间
            </Button>
            <Button
              icon={<DisconnectOutlined />}
              onClick={() => void handleRemount()}
              disabled={!selectedDeviceId}
            >
              Root+Remount
            </Button>
            <Button onClick={() => void handleReboot()} disabled={!selectedDeviceId}>
              重启设备
            </Button>
          </Space>
        </Card>

        {/* 截图 */}
        <Card type="inner" title="截图">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              onClick={() => void handleScreencap()}
              loading={screenshotLoading}
              disabled={!selectedDeviceId}
            >
              截取当前屏幕
            </Button>
            {renderScreenshotPreview()}
          </Space>
        </Card>

        {/* APK 管理 */}
        <Card type="inner" title="APK 管理">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Space wrap>
              <Upload {...uploadProps}>
                <Button icon={<UploadOutlined />}>选择 APK 文件</Button>
              </Upload>
              {apkFileName && <Text>已选择：{apkFileName}</Text>}
              <Checkbox
                checked={overwriteInstall}
                onChange={(e) => setOverwriteInstall(e.target.checked)}
              >
                覆盖安装
              </Checkbox>
              <Button
                type="primary"
                onClick={() => void handleInstallApk()}
                loading={installing}
                disabled={!selectedDeviceId}
              >
                安装 APK
              </Button>
            </Space>
            <Space wrap style={{ marginTop: 8 }}>
              <Input
                placeholder="输入要卸载的包名，例如 com.example.app"
                style={{ minWidth: 260, maxWidth: 360 }}
                value={uninstallPackage}
                onChange={(e) => setUninstallPackage(e.target.value)}
              />
              <Button
                danger
                onClick={() => void handleUninstallApk()}
                loading={uninstalling}
                disabled={!selectedDeviceId}
              >
                卸载应用
              </Button>
            </Space>
          </Space>
        </Card>

        {/* 包管理 */}
        <Card type="inner" title="包管理">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Space wrap>
              <Button
                onClick={() => void handleLoadPackages()}
                loading={loadingPackages}
                disabled={!selectedDeviceId}
              >
                查看已安装应用
              </Button>
              <Input
                placeholder="输入关键字过滤包名"
                style={{ minWidth: 220, maxWidth: 320 }}
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value)}
              />
            </Space>
            <List
              size="small"
              bordered
              loading={loadingPackages}
              dataSource={filteredPackages}
              locale={{ emptyText: '暂无应用数据' }}
              style={{ maxHeight: 260, overflow: 'auto' }}
              pagination={
                filteredPackages.length > 0
                  ? {
                      pageSize: 50,
                      simple: true,
                    }
                  : undefined
              }
              renderItem={(item) => <List.Item>{item}</List.Item>}
            />
          </Space>
        </Card>

        {/* 自定义 shell 命令 */}
        <Card type="inner" title="自定义 shell 命令">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              仅支持单条命令，不允许使用管道符、重定向或组合运算符（例如
              <Text code>pm list packages | grep xxx</Text>
              将被拦截）。
            </Paragraph>
            <Input.TextArea
              rows={3}
              placeholder="例如：pm list packages 或 dumpsys package com.example.app"
              value={shellCommand}
              onChange={(e) => setShellCommand(e.target.value)}
            />
            <Space>
              <Button
                type="primary"
                onClick={() => void handleExecuteShell()}
                loading={shellRunning}
                disabled={!selectedDeviceId}
              >
                执行命令
              </Button>
              <Button
                onClick={() => {
                  setShellCommand('');
                  setShellResult({ stdout: '', stderr: '' });
                  setSecurityAlert(null);
                }}
              >
                清空
              </Button>
            </Space>
            {(shellResult.stdout || shellResult.stderr) && (
              <div
                style={{
                  border: '1px solid #f0f0f0',
                  borderRadius: 4,
                  padding: 8,
                  maxHeight: 260,
                  overflow: 'auto',
                  background: '#fafafa',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              >
                {shellResult.stdout && (
                  <>
                    <Text strong>stdout:</Text>
                    <pre style={{ margin: '4px 0 8px' }}>{shellResult.stdout}</pre>
                  </>
                )}
                {shellResult.stderr && (
                  <>
                    <Text strong>stderr:</Text>
                    <pre style={{ margin: 0, color: '#c0392b' }}>{shellResult.stderr}</pre>
                  </>
                )}
              </div>
            )}
          </Space>
        </Card>
      </Space>
    </Card>
  );
};

export default ToolsPage;
