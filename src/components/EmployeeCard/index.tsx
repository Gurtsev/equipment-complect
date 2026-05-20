import { useState, useEffect, useCallback } from 'react';
import {
  Drawer, Typography, Tag, Avatar, Button, Table, Divider,
  Empty, Spin, Flex, Select, Input, Modal, App,
} from 'antd';
import { UserOutlined, RollbackOutlined, SwapOutlined } from '@ant-design/icons';
import { assignmentService, ProfileAssignment } from '../../services/assignmentService';
import { loanService, EquipmentLoanSummary } from '../../services/loanService';
import { Profile } from '../../services/usersService';
import { Equipment } from '../../models/Equipment';
import { UserRole } from '../../contexts/AuthContext';

const { Text, Title } = Typography;

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

interface Props {
  profile: Profile;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  allEquipment: Equipment[];
  onChanged: () => void;
}

export function EmployeeCard({ profile, open, onClose, canEdit, allEquipment, onChanged }: Props) {
  const { message } = App.useApp();
  const [assignments, setAssignments] = useState<ProfileAssignment[]>([]);
  const [activeLoans, setActiveLoans] = useState<EquipmentLoanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<string | undefined>();
  const [pickerNotes, setPickerNotes] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [data, loans] = await Promise.all([
        assignmentService.getForProfile(profile.id),
        loanService.getActiveLoansForProfile(profile.id),
      ]);
      setAssignments(data);
      setActiveLoans(loans);
    } catch {
      void message.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [profile.id, message]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const current = assignments.filter(a => !a.returnedAt);
  const history = assignments.filter(a => !!a.returnedAt);

  const handleReturn = async (a: ProfileAssignment) => {
    try {
      await assignmentService.returnEquipment(a.id, a.equipmentId);
      void reload();
      onChanged();
      void message.success(`${a.equipmentModel} возвращено`);
    } catch {
      void message.error('Ошибка при возврате');
    }
  };

  const handleAssign = async () => {
    if (!pickerValue) { void message.error('Выберите оборудование'); return; }
    const eq = allEquipment.find(e => e.id === pickerValue);
    if (!eq) return;
    setPickerLoading(true);
    try {
      await assignmentService.assign(eq.id, profile.id, profile.name, eq.currentLocation, pickerNotes || undefined);
      setPickerOpen(false);
      setPickerValue(undefined);
      setPickerNotes('');
      void reload();
      onChanged();
      void message.success(`${eq.model} выдан сотруднику`);
    } catch {
      void message.error('Ошибка при выдаче');
    } finally {
      setPickerLoading(false);
    }
  };

  const availableEquipment = allEquipment.filter(e =>
    e.currentStatus === 'На Складе' &&
    !current.some(a => a.equipmentId === e.id),
  );

  const currentColumns = [
    {
      key: 'eq',
      render: (_: unknown, a: ProfileAssignment) => (
        <Flex gap={10} align="center">
          <Avatar src={a.equipmentImage} shape="square" size={36} style={{ borderRadius: 4, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 13, display: 'block', wordBreak: 'normal', overflowWrap: 'break-word' }}>
              {a.equipmentModel}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{a.equipmentInvNumber}</Text>
            {a.notes && <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{a.notes}</Text>}
          </div>
        </Flex>
      ),
    },
    {
      key: 'date',
      width: 100,
      render: (_: unknown, a: ProfileAssignment) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          с {a.assignedAt.toLocaleDateString('ru-RU')}
        </Text>
      ),
    },
    {
      key: 'action',
      width: 80,
      render: (_: unknown, a: ProfileAssignment) => canEdit ? (
        <Button
          size="small"
          icon={<RollbackOutlined />}
          onClick={() => void handleReturn(a)}
        >
          Вернуть
        </Button>
      ) : null,
    },
  ];

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { padding: 0 } }}
    >
      {/* Profile header */}
      <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Flex gap={16} align="center">
          <Avatar size={48} icon={<UserOutlined />} style={{ background: '#1677ff', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, wordBreak: 'normal', overflowWrap: 'break-word' }}>
              {profile.name}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>{profile.email}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag color={ROLE_COLOR[profile.role]}>{ROLE_LABEL[profile.role]}</Tag>
            </div>
          </div>
        </Flex>
      </div>

      <div style={{ padding: 24 }}>
        {/* Current equipment */}
        <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
          <Text strong>Выдано сейчас ({current.length})</Text>
          {canEdit && (
            <Button
              size="small"
              type="primary"
              icon={<UserOutlined />}
              onClick={() => { setPickerValue(undefined); setPickerNotes(''); setPickerOpen(true); }}
              disabled={availableEquipment.length === 0}
            >
              Выдать
            </Button>
          )}
        </Flex>

        {loading ? (
          <Flex justify="center" style={{ padding: 24 }}><Spin /></Flex>
        ) : current.length === 0 ? (
          <Empty description="Ничего не выдано" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '12px 0' }} />
        ) : (
          <Table
            dataSource={current}
            columns={currentColumns}
            rowKey="id"
            size="small"
            pagination={false}
            showHeader={false}
          />
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0 12px' }} />
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              История выдач ({history.length})
            </Text>
            <Table
              dataSource={history}
              columns={[
                {
                  key: 'eq',
                  render: (_: unknown, a: ProfileAssignment) => (
                    <Flex gap={8} align="center">
                      <Avatar src={a.equipmentImage} shape="square" size={28} style={{ borderRadius: 4, flexShrink: 0, opacity: 0.6 }} />
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>{a.equipmentModel}</Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          {a.assignedAt.toLocaleDateString('ru-RU')} — {a.returnedAt!.toLocaleDateString('ru-RU')}
                        </Text>
                      </div>
                    </Flex>
                  ),
                },
              ]}
              rowKey="id"
              size="small"
              pagination={false}
              showHeader={false}
            />
          </>
        )}
      </div>

      {/* Активные займы */}
      {activeLoans.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <Divider style={{ margin: '16px 0 12px' }} />
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            Временные займы ({activeLoans.length})
          </Text>
          <Table
            dataSource={activeLoans}
            rowKey="id"
            size="small"
            pagination={false}
            showHeader={false}
            columns={[
              {
                key: 'eq',
                render: (_: unknown, a: EquipmentLoanSummary) => (
                  <Flex gap={10} align="center">
                    <Avatar src={a.equipmentImage ?? undefined} shape="square" size={36} style={{ borderRadius: 4, flexShrink: 0 }} />
                    <div>
                      <Text strong style={{ fontSize: 13 }}>{a.equipmentModel}</Text>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        {a.equipmentInvNumber}
                        {a.notes && ` · ${a.notes}`}
                      </Text>
                    </div>
                  </Flex>
                ),
              },
              {
                key: 'date',
                width: 130,
                render: (_: unknown, a: EquipmentLoanSummary) => (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <SwapOutlined style={{ color: '#1677ff', marginRight: 4 }} />
                    с {a.issuedAt.toLocaleDateString('ru-RU')}
                    {a.dueDate && (
                      <div>до {a.dueDate.toLocaleDateString('ru-RU')}</div>
                    )}
                  </Text>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Picker modal */}
      <Modal
        title="Выдать оборудование"
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        okText="Выдать"
        cancelText="Отмена"
        confirmLoading={pickerLoading}
        onOk={() => void handleAssign()}
      >
        <Flex vertical gap={12} style={{ marginTop: 8 }}>
          <Select
            placeholder="Выберите оборудование"
            value={pickerValue}
            onChange={setPickerValue}
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={availableEquipment.map(e => ({
              value: e.id,
              label: `${e.model} · ${e.invNumber}`,
            }))}
          />
          <Input
            placeholder="Примечание (необязательно)"
            value={pickerNotes}
            onChange={e => setPickerNotes(e.target.value)}
          />
        </Flex>
      </Modal>
    </Drawer>
  );
}
