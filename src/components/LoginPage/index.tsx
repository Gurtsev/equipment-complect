import { useState } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { signIn } = useAuth();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: FormValues) => {
    setLoading(true);
    const error = await signIn(values.email, values.password);
    setLoading(false);
    if (error) void message.error('Неверный email или пароль');
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f7fa',
      }}
    >
      <Card style={{ width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={4} style={{ margin: '0 0 4px' }}>
            Инвентарь студии
          </Title>
          <Text type="secondary">Войдите в систему</Text>
        </div>

        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Неверный формат' },
            ]}
          >
            <Input placeholder="name@studio.ru" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password placeholder="••••••••" autoComplete="current-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block style={{ marginTop: 4 }}>
            Войти
          </Button>
        </Form>
      </Card>
    </div>
  );
}
