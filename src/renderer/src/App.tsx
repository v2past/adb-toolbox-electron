import React, { useEffect } from 'react';
import { Layout, Menu } from 'antd';
import {
  DesktopOutlined,
  ToolOutlined,
  FileSearchOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  MobileOutlined,
} from '@ant-design/icons';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import DevicesPage from './pages/DevicesPage';
import ToolsPage from './pages/ToolsPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import ScrcpyPage from './pages/ScrcpyPage';
import { useAppStore } from './store/appStore';

const { Header, Content, Sider } = Layout;

const AppLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setDevices, initializeSettings } = useAppStore();

  useEffect(() => {
    void (async () => {
      try {
        await initializeSettings();
        const res = await window.api?.getDevices();
        if (res?.ok && res.data) {
          setDevices(res.data);
        } else if (res && !res.ok) {
          console.error('获取设备列表失败', res.error);
        }
      } catch (error) {
        // 占位：后续可接入全局消息提示组件
        console.error('获取设备列表失败', error);
      }
    })();
  }, [initializeSettings, setDevices]);

  const selectedKey = (() => {
    if (location.pathname.startsWith('/tools')) return '/tools';
    if (location.pathname.startsWith('/logs')) return '/logs';
    if (location.pathname.startsWith('/settings')) return '/settings';
    if (location.pathname.startsWith('/about')) return '/about';
    if (location.pathname.startsWith('/scrcpy')) return '/scrcpy';
    return '/';
  })();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div className="logo">ADB Toolbox</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(info) => navigate(info.key)}
          items={[
            { key: '/', icon: <DesktopOutlined />, label: '设备管理' },
            { key: '/tools', icon: <ToolOutlined />, label: '工具箱' },
            { key: '/scrcpy', icon: <MobileOutlined />, label: '虚拟投屏' },
            { key: '/logs', icon: <FileSearchOutlined />, label: '日志监控' },
            { key: '/settings', icon: <SettingOutlined />, label: '设置' },
            { key: '/about', icon: <InfoCircleOutlined />, label: '关于' },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>
          <h1 style={{ margin: 0 }}>ADB 工具箱</h1>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div className="content-wrapper">
            <Routes>
              <Route path="/" element={<DevicesPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/scrcpy" element={<ScrcpyPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => <AppLayout />;

export default App;
