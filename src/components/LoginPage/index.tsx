import { useState } from 'react';
import { Form, Input, Button, Card, Typography, App, Tabs } from 'antd';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

export function LoginPage() {
  const { signIn, signUp, forgotPassword } = useAuth();
  const { message } = App.useApp();
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoginLoading(true);
    const error = await signIn(values.email, values.password);
    setLoginLoading(false);
    if (error) void message.error('Неверный email или пароль');
  };

  const handleForgot = async (values: { email: string }) => {
    setForgotLoading(true);
    const error = await forgotPassword(values.email);
    setForgotLoading(false);
    if (error) {
      void message.error(error);
    } else {
      void message.success('Ссылка для сброса пароля отправлена на почту');
      setForgotVisible(false);
    }
  };

  const handleRegister = async (values: { name: string; email: string; password: string }) => {
    setRegisterLoading(true);
    const error = await signUp(values.email, values.password, values.name);
    setRegisterLoading(false);
    if (error) void message.error(error);
  };

  const card = (
    <Card style={{ width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: '0 0 4px' }}>
          Инвентарь студии
        </Title>
        <Text type="secondary">megapolis.media</Text>
      </div>

      <Tabs
        centered
        items={[
          {
            key: 'login',
            label: 'Войти',
            children: (
              <>
                <Form layout="vertical" onFinish={handleLogin} requiredMark={false}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Введите email' },
                      { type: 'email', message: 'Неверный формат' },
                    ]}
                  >
                    <Input placeholder="name@megapolis.media" autoComplete="email" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Пароль"
                    rules={[{ required: true, message: 'Введите пароль' }]}
                  >
                    <Input.Password placeholder="••••••••" autoComplete="current-password" />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" loading={loginLoading} block style={{ marginTop: 4 }}>
                    Войти
                  </Button>
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <Button type="link" size="small" onClick={() => setForgotVisible(!forgotVisible)}>
                      Забыли пароль?
                    </Button>
                  </div>
                </Form>

                {forgotVisible && (
                  <Form layout="vertical" onFinish={handleForgot} requiredMark={false} style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                    <Form.Item
                      name="email"
                      label="Email для восстановления"
                      rules={[
                        { required: true, message: 'Введите email' },
                        { type: 'email', message: 'Неверный формат' },
                      ]}
                    >
                      <Input placeholder="name@megapolis.media" autoComplete="email" />
                    </Form.Item>
                    <Button type="default" htmlType="submit" loading={forgotLoading} block>
                      Отправить ссылку
                    </Button>
                  </Form>
                )}
              </>
            ),
          },
          {
            key: 'register',
            label: 'Зарегистрироваться',
            children: (
              <Form layout="vertical" onFinish={handleRegister} requiredMark={false}>
                <Form.Item
                  name="name"
                  label="Имя"
                  rules={[{ required: true, message: 'Введите имя' }]}
                >
                  <Input placeholder="Иван Иванов" autoComplete="name" />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Введите email' },
                    { type: 'email', message: 'Неверный формат' },
                  ]}
                >
                  <Input placeholder="name@example.com" autoComplete="email" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Пароль"
                  rules={[
                    { required: true, message: 'Введите пароль' },
                    { min: 6, message: 'Минимум 6 символов' },
                  ]}
                >
                  <Input.Password placeholder="••••••••" autoComplete="new-password" />
                </Form.Item>

                <Form.Item
                  name="confirm"
                  label="Повторите пароль"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Повторите пароль' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject('Пароли не совпадают');
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="••••••••" autoComplete="new-password" />
                </Form.Item>

                <Button type="primary" htmlType="submit" loading={registerLoading} block style={{ marginTop: 4 }}>
                  Создать аккаунт
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </Card>
  );

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
      {card}
    </div>
  );
}
