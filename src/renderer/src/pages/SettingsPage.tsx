import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Button, Space, message } from 'antd';
import { useAppStore } from '../store/appStore';

const SettingsPage: React.FC = () => {
  const { settings, updateSettingsState } = useAppStore();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue(settings);
  }, [settings, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await window.api?.updateSettings(values);
      if (res?.ok && res.data) {
        updateSettingsState(res.data);
        message.success('设置已保存');
      } else if (res && !res.ok) {
        message.error(res.error?.message ?? '保存设置失败');
      }
    } catch (error) {
      if (error) {
        console.error('保存设置失败', error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="设置" bordered={false}>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item label="ADB 可执行文件路径" name="adbPath">
          <Input placeholder="例如：C:\\Android\\sdk\\platform-tools\\adb.exe 或 /usr/local/bin/adb" />
        </Form.Item>
        <Form.Item label="日志默认保存路径" name="logSaveDirectory">
          <Input placeholder="留空则使用系统文档目录或内置默认路径" />
        </Form.Item>
        <Form.Item
          label="自动检测设备间隔（毫秒）"
          name="devicePollIntervalMs"
          rules={[
            { required: true, message: '请输入轮询间隔' },
            { type: 'number', min: 500, max: 60000, message: '轮询间隔需在 500–60000 之间' },
          ]}
        >
          <InputNumber min={500} max={60000} step={500} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={handleSubmit}>
              保存设置
            </Button>
            <Button
              onClick={() => {
                form.setFieldsValue(settings);
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SettingsPage;
