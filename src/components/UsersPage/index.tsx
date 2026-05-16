import { useEffect, useState } from 'react';
import {
  Table, Select, Button, Popconfirm, Tabs, Form, Input, App,
  Tag, Typography, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { usersService, Profile, AllowedEntry } from '../../services/usersService';
import type { UserRole } from '../../contexts/AuthContext';

const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор' },
  { value: 'operator', label: 'Оператор' },
  { value: 'viewer', label: 'Наблюдатель' },
];

const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'red',
  operator: 'blue',
  viewer: 'default',
};

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Наблюдатель',
};

export function UsersPage() {
  const { message, modal } = App.useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allowed, setAllowed] = useState<AllowedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addForm] = Form.useForm();
  const [addMode, setAddMode] = useState<'email' | 'domain'>('domain');
  const [addLoading, setAddLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        usersService.getProfiles(),
        usersService.getAllowedEntries(),
      ]);
      setProfiles(p);
      setAllowed(a);
    } catch {
      void message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      await usersService.updateProfile(id, { role });
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, role } : p));
    } catch {
      void message.error('Ошибка при смене роли');
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    modal.confirm({
      title: `Деактивировать ${name}?`,
      content: 'Пользователь потеряет доступ. Аккаунт сохранится и его можно восстановить.',
      okText: 'Деактивировать',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await usersService.deleteProfile(id);
          setProfiles((prev) => prev.filter((p) => p.id !== id));
          void message.success('Пользователь деактивирован');
        } catch {
          void message.error('Ошибка при деактивации');
        }
      },
    });
  };

  const handleAddAllowed = async (values: { value: string; role: UserRole; note?: string }) => {
    setAddLoading(true);
    const entry: Parameters<typeof usersService.addAllowedEntry>[0] = {
      email: addMode === 'email' ? values.value.trim().toLowerCase() : null,
      domain: addMode === 'domain' ? values.value.trim().toLowerCase().replace(/^@/, '') : null,
      role: values.role,
      note: values.note?.trim() || null,
    };
    try {
      await usersService.addAllowedEntry(entry);
      addForm.resetFields();
      void load();
      void message.success('Добавлено');
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? '';
      void message.error(msg.includes('unique') ? 'Уже существует' : 'Ошибка при добавлении');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteAllowed = async (id: string) => {
    try {
      await usersService.deleteAllowedEntry(id);
      setAllowed((prev) => prev.filter((a) => a.id !== id));
    } catch {
      void message.error('Ошибка при удалении');
    }
  };

  const profileColumns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Profile) => (
        <div>
          <div>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.email ?? '—'}</Text>
        </div>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      render: (role: UserRole, record: Profile) => (
        <Select
          value={role}
          size="small"
          style={{ width: 160 }}
          options={ROLE_OPTIONS}
          onChange={(val) => void handleRoleChange(record.id, val as UserRole)}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: unknown, record: Profile) => (
        <Tooltip title="Деактивировать">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => void handleDeactivate(record.id, record.name)}
          />
        </Tooltip>
      ),
    },
  ];

  const allowedColumns = [
    {
      title: 'Адрес / домен',
      key: 'target',
      render: (_: unknown, record: AllowedEntry) => (
        <div>
          {record.domain
            ? <Tag color="blue">@{record.domain}</Tag>
            : <Text code>{record.email}</Text>}
          {record.note && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>{record.note}</Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Роль по умолчанию',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: UserRole) => (
        <Tag color={ROLE_COLOR[role]}>{ROLE_LABEL[role]}</Tag>
      ),
    },
    {
      title: '',
      key: 'del',
      width: 48,
      render: (_: unknown, record: AllowedEntry) => (
        <Popconfirm
          title="Удалить запись?"
          description="Существующие пользователи не пострадают."
          okText="Удалить"
          okButtonProps={{ danger: true }}
          cancelText="Отмена"
          onConfirm={() => void handleDeleteAllowed(record.id)}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 24px', maxWidth: 800 }}>
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 20 }}>
        Управление пользователями
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'users',
            label: 'Пользователи',
            children: (
              <Table
                dataSource={profiles}
                columns={profileColumns}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={false}
                locale={{ emptyText: 'Нет пользователей' }}
              />
            ),
          },
          {
            key: 'access',
            label: 'Разрешённые адреса',
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <Form
                  form={addForm}
                  layout="inline"
                  onFinish={(v) => void handleAddAllowed(v)}
                  initialValues={{ role: 'viewer' }}
                  style={{ flexWrap: 'wrap', gap: 8 }}
                >
                  <Form.Item style={{ marginBottom: 0 }}>
                    <Select
                      value={addMode}
                      onChange={setAddMode}
                      options={[
                        { value: 'domain', label: 'Домен' },
                        { value: 'email', label: 'Email' },
                      ]}
                      style={{ width: 110 }}
                    />
                  </Form.Item>

                  <Form.Item
                    name="value"
                    rules={[{ required: true, message: ' ' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input
                      placeholder={addMode === 'domain' ? 'megapolis.media' : 'user@example.com'}
                      style={{ width: 200 }}
                    />
                  </Form.Item>

                  <Form.Item name="role" style={{ marginBottom: 0 }}>
                    <Select options={ROLE_OPTIONS} style={{ width: 160 }} />
                  </Form.Item>

                  <Form.Item name="note" style={{ marginBottom: 0 }}>
                    <Input placeholder="Комментарий" style={{ width: 140 }} />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<PlusOutlined />}
                      loading={addLoading}
                    >
                      Добавить
                    </Button>
                  </Form.Item>
                </Form>

                <Table
                  dataSource={allowed}
                  columns={allowedColumns}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'Список пуст' }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
