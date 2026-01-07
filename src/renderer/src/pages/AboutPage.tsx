import React from 'react';
import { Card, Descriptions, Button, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const AboutPage: React.FC = () => {
  const handleOpenFeedback = () => {
    window.open(
      'https://www.larkoffice.com/invitation/page/add_contact/?token=e15l10eb-e242-4e92-bf5f-034ecc0eee76&unique_id=MrRoADefJMIk5Y-t6w2Ung==',
      '_blank'
    );
  };

  return (
    <Card title="关于 ADB Toolbox" bordered={false}>
      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'author',
            label: '作者',
            children: 'ByteDance 马杰',
          },
          {
            key: 'version',
            label: '版本',
            children: 'v1.0.0',
          },
          {
            key: 'description',
            label: '简介',
            children: 'ADB Toolbox 是一个基于 Electron 的 Android 调试桥工具，提供设备管理、工具箱、日志监控等功能。',
          },
        ]}
      />
      <div style={{ marginTop: 24 }}>
        <Space>
          <Button type="primary" icon={<InfoCircleOutlined />} onClick={handleOpenFeedback}>
            打开需求提交
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default AboutPage;
