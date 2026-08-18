import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Descriptions,
  Tag,
  Table,
  Select,
  Button,
  Input,
  Space,
  Modal,
  Flex,
  App,
  Grid,
  Avatar,
  Alert,
  Popconfirm,
} from 'antd';
import { QrcodeOutlined, EditOutlined, PrinterOutlined, ArrowLeftOutlined, UserOutlined, SwapOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import {
  AssemblyStatus,
  Equipment,
  EquipmentStatus,
  EquipmentLocation,
  HistoryEntry,
} from '../../models/Equipment';
import { Project } from '../../models/Project';
import { assignmentService, Assignment } from '../../services/assignmentService';
import { loanService, Loan } from '../../services/loanService';
import { getCustodyErrorMessage } from '../../services/custodyErrors';
import { getRoomPath } from '../../services/roomService';
import { usersService, Profile } from '../../services/usersService';

const { Title, Text } = Typography;

// 'Забронировано' не включён — статус проставляется только через проекты
const STATUSES: EquipmentStatus[] = ['В Работе', 'На Складе', 'В Ремонте', 'Списано', 'В Пути'];
const LOCATIONS: EquipmentLocation[] = ['Склад', 'Ремонт', 'В пути', 'На руках', 'Офис'];

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'success',
  'На Складе': 'processing',
  'В Ремонте': 'warning',
  'Списано': 'error',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
  'Выдан': 'volcano',
  'Комплектуется': 'geekblue',
};

const CATEGORY_LABEL: Record<Equipment['category'], string> = {
  camera: 'Камера',
  microphone: 'Микрофон',
  light: 'Свет',
  computer: 'Компьютер',
  laptop: 'Ноутбук',
  tv: 'Телевизор',
  audio: 'Аудио',
  accessory: 'Аксессуар',
  optics: 'Оптика',
  phone: 'Телефон',
  stand: 'Стойка/Штатив',
  mount: 'Крепление',
  network: 'Сетевое',
  cable: 'Кабель',
  furniture: 'Мебель',
  prop: 'Реквизит',
  tool: 'Инструмент',
};

const ASSEMBLY_STATUS_LABEL: Record<AssemblyStatus, string> = {
  assembling: 'Комплектуется',
  ready: 'Готов к сверке',
  synced: 'Синхронизирован',
};

const ASSEMBLY_STATUS_COLOR: Record<AssemblyStatus, string> = {
  assembling: 'processing',
  ready: 'success',
  synced: 'default',
};

const CATEGORY_COLOR: Record<Equipment['category'], string> = {
  camera: 'blue',
  microphone: 'magenta',
  light: 'gold',
  computer: 'green',
  laptop: 'geekblue',
  tv: 'purple',
  audio: 'purple',
  accessory: 'default',
  optics: 'cyan',
  phone: 'geekblue',
  stand: 'default',
  mount: 'cyan',
  network: 'geekblue',
  cable: 'orange',
  furniture: 'lime',
  prop: 'orange',
  tool: 'volcano',
};

const historyColumns = [
  {
    title: 'Дата',
    dataIndex: 'date',
    key: 'date',
    render: (d: Date) => d.toLocaleString('ru-RU'),
    width: 160,
  },
  {
    title: 'Статус',
    dataIndex: 'status',
    key: 'status',
    render: (s: EquipmentStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
    width: 145,
  },
  {
    title: 'Местоположение',
    dataIndex: 'location',
    key: 'location',
  },
  {
    title: 'Ответственный',
    dataIndex: 'responsible',
    key: 'responsible',
  },
  {
    title: 'Изменил',
    dataIndex: 'userName',
    key: 'userName',
    render: (name: string | undefined) => name
      ? <Typography.Text type="secondary">{name}</Typography.Text>
      : null,
  },
];

interface Props {
  equipment: Equipment;
  canEdit: boolean;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete?: () => Promise<void>;
  onDuplicate?: () => void;
  project?: Project | null;
  equipmentProjects?: Project[];
  onProjectClick?: (project: Project) => void;
  onStatusUpdate?: (status: EquipmentStatus, location: EquipmentLocation, responsible: string) => Promise<void>;
  onBack?: () => void;
  rooms?: import('../../services/roomService').Room[];
  allEquipment?: Equipment[];
  onComponentClick?: (equipment: Equipment) => void;
  onDetach?: () => Promise<void>;
  onAssemblyStatusChange?: (status: AssemblyStatus) => Promise<void>;
}

export function EquipmentDetail({ equipment, canEdit, isAdmin, onEdit, onDelete, onDuplicate, project, equipmentProjects, onProjectClick, onStatusUpdate, onBack, rooms = [], allEquipment = [], onComponentClick, onDetach, onAssemblyStatusChange }: Props) {
  const { message } = App.useApp();
  const equipmentUrl = `${window.location.origin}${window.location.pathname}?eq=${equipment.id}`;
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [status, setStatus] = useState<EquipmentStatus>(equipment.currentStatus);
  const [location, setLocation] = useState<EquipmentLocation>(equipment.currentLocation);
  const [changedBy, setChangedBy] = useState(equipment.responsible);
  const [history, setHistory] = useState<HistoryEntry[]>(equipment.history);
  const [qrOpen, setQrOpen] = useState(false);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignProfileId, setAssignProfileId] = useState<string | undefined>();
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  const [openLoans, setOpenLoans] = useState<Loan[]>([]);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanProfileId, setLoanProfileId] = useState<string | undefined>();
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [loanLoading, setLoanLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [assemblyLoading, setAssemblyLoading] = useState(false);

  const parent = equipment.parentId ? allEquipment.find((e) => e.id === equipment.parentId) ?? null : null;
  const components = allEquipment.filter((e) => e.parentId === equipment.id);

  const handleDetach = async () => {
    setDetachLoading(true);
    try {
      await onDetach?.();
      void message.success('Компонент отвязан от комплекта');
    } catch {
      void message.error('Ошибка при отвязке');
    } finally {
      setDetachLoading(false);
    }
  };

  const handleAssemblyStatusChange = async (s: AssemblyStatus) => {
    setAssemblyLoading(true);
    try {
      await onAssemblyStatusChange?.(s);
    } catch {
      void message.error('Ошибка при обновлении статуса сборки');
    } finally {
      setAssemblyLoading(false);
    }
  };

  const loadAssignment = useCallback(async () => {
    try {
      const a = await assignmentService.getCurrentAssignment(equipment.id);
      setAssignment(a);
    } catch {
      void message.error('Ошибка при загрузке текущей выдачи');
    }
  }, [equipment.id, message]);

  const loadOpenLoans = useCallback(async () => {
    try {
      const loans = await loanService.getOpenLoans(equipment.id);
      setOpenLoans(loans);
    } catch {
      void message.error('Ошибка при загрузке займов');
    }
  }, [equipment.id, message]);

  useEffect(() => { void loadAssignment(); void loadOpenLoans(); }, [loadAssignment, loadOpenLoans]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeLoan = openLoans.find((l) => {
    const s = l.startDate ?? today;
    return s <= today;
  }) ?? null;
  const upcomingLoans = openLoans.filter((l) => l.startDate && l.startDate > today);

  const handleStatusChange = (val: EquipmentStatus) => {
    setStatus(val);
    if (val === 'В Ремонте') setLocation('Ремонт');
  };

  const handleSave = async () => {
    await onStatusUpdate?.(status, location, changedBy);
    equipment.addHistoryEntry(status, location, changedBy);
    setHistory([...equipment.history]);
    void message.success('Статус обновлён');
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await onDelete?.();
      void message.success('Карточка удалена');
    } catch {
      void message.error('Ошибка при удалении');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? '12px' : 24, maxWidth: 860, margin: '0 auto', overflowX: 'hidden' }}>
      {onBack && (
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={onBack}
          style={{ marginBottom: 12, paddingLeft: 0 }}
        >
          Назад
        </Button>
      )}
      {/* Header card */}
      <Card style={{ marginBottom: 16 }} className="no-print">
        <Flex gap={isMobile ? 12 : 20} align="flex-start">
          <div
            className="equipment-image"
            style={{
              width: isMobile ? 80 : 180,
              height: isMobile ? 60 : 130,
              backgroundImage: `url('${equipment.image}')`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundColor: '#f5f5f5',
              borderRadius: 8,
              flexShrink: 0,
              border: '1px solid #f0f0f0',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex gap={6} style={{ marginBottom: 6 }} wrap>
              <Tag color={CATEGORY_COLOR[equipment.category]}>
                {CATEGORY_LABEL[equipment.category]}
              </Tag>
              <Tag color={STATUS_COLOR[equipment.currentStatus]}>{equipment.currentStatus}</Tag>
              {components.length > 0 && (
                <Tag color="default">🔗 {components.length}</Tag>
              )}
              {parent && (
                <Tag
                  color="default"
                  style={{ cursor: onComponentClick ? 'pointer' : 'default' }}
                  onClick={() => onComponentClick?.(parent)}
                >
                  ↳ часть: {parent.model}
                </Tag>
              )}
            </Flex>
            <Title level={isMobile ? 5 : 4} style={{ margin: '0 0 2px', wordBreak: 'normal', overflowWrap: 'break-word' }}>
              {equipment.model}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {equipment.subtitle}
            </Text>
            {!isMobile && (
              <div style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 13 }}>{equipment.description}</Text>
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              📍 {equipment.currentLocation}
            </Text>
          </div>
        </Flex>
        <Flex gap={8} className="no-print" wrap style={{ marginTop: 12 }}>
          {canEdit && (
            <Button icon={<EditOutlined />} onClick={onEdit}>
              Изменить
            </Button>
          )}
          {canEdit && onDuplicate && (
            <Button icon={<CopyOutlined />} onClick={onDuplicate}>
              Дублировать
            </Button>
          )}
          <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
            Печать
          </Button>
          <Button icon={<QrcodeOutlined />} onClick={() => setQrOpen(true)}>
            QR-код
          </Button>
          {canEdit && equipment.currentStatus !== 'Выдан' && equipment.currentStatus !== 'Забронировано' && equipment.currentStatus !== 'В Работе' && equipment.currentStatus !== 'Комплектуется' && (
            <Button
              icon={<UserOutlined />}
              onClick={async () => {
                const p = await usersService.getProfiles();
                setProfiles(p);
                setAssignProfileId(undefined);
                setAssignNotes('');
                setAssignOpen(true);
              }}
            >
              Выдать сотруднику
            </Button>
          )}
          {canEdit && !assignment && equipment.currentStatus !== 'Комплектуется' && (
            <Button
              icon={<SwapOutlined />}
              onClick={async () => {
                const p = await usersService.getProfiles();
                setProfiles(p);
                setLoanProfileId(undefined);
                setLoanStartDate('');
                setLoanDueDate('');
                setLoanNotes('');
                setLoanOpen(true);
              }}
            >
              Временный займ
            </Button>
          )}
          {canEdit && assignment && (
            <Button
              danger
              icon={<UserOutlined />}
              onClick={async () => {
                try {
                  await assignmentService.returnEquipment(assignment.id);
                  void loadAssignment();
                  void message.success('Оборудование возвращено на склад');
                } catch {
                  void message.error('Ошибка при возврате');
                }
              }}
            >
              Вернуть
            </Button>
          )}
          {canEdit && parent && onDetach && (
            <Popconfirm
              title="Отвязать от комплекта?"
              description="Компонент станет самостоятельной единицей со своей историей статусов."
              okText="Отвязать"
              cancelText="Отмена"
              onConfirm={() => void handleDetach()}
            >
              <Button loading={detachLoading}>Отвязать от комплекта</Button>
            </Popconfirm>
          )}
          {isAdmin && onDelete && (
            <Popconfirm
              title="Удалить карточку оборудования?"
              description="Это действие необратимо: история, выдачи и займы по этой единице тоже будут удалены."
              okText="Удалить"
              okButtonProps={{ danger: true, loading: deleteLoading }}
              cancelText="Отмена"
              onConfirm={() => void handleDelete()}
            >
              <Button danger icon={<DeleteOutlined />} loading={deleteLoading}>
                Удалить
              </Button>
            </Popconfirm>
          )}
        </Flex>

        {assignment && (
          <Flex align="center" gap={8} style={{ marginTop: 12, padding: '8px 12px', background: '#fff7e6', borderRadius: 8 }} className="no-print">
            <Avatar size={28} icon={<UserOutlined />} style={{ background: '#fa8c16', flexShrink: 0 }} />
            <div>
              <Text strong style={{ fontSize: 13 }}>Выдан: {assignment.profileName}</Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                с {assignment.assignedAt.toLocaleDateString('ru-RU')}
                {assignment.notes && ` · ${assignment.notes}`}
              </Text>
            </div>
          </Flex>
        )}

        {activeLoan && (
          <Flex align="center" gap={8} style={{ marginTop: 12, padding: '8px 12px', background: '#e6f4ff', borderRadius: 8 }} className="no-print">
            <SwapOutlined style={{ color: '#1677ff', fontSize: 18, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: 13 }}>
                Займ: {activeLoan.toProfileName ?? '—'}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                {(activeLoan.startDate ?? activeLoan.issuedAt).toLocaleDateString('ru-RU')}
                {activeLoan.dueDate && ` — ${activeLoan.dueDate.toLocaleDateString('ru-RU')}`}
                {activeLoan.notes && ` · ${activeLoan.notes}`}
              </Text>
            </div>
            {canEdit && (
              <Button size="small" danger onClick={async () => {
                try {
                  await loanService.returnLoan(activeLoan.id);
                  void loadOpenLoans();
                  void message.success('Займ закрыт, оборудование на складе');
                } catch {
                  void message.error('Ошибка при возврате');
                }
              }}>
                Вернуть
              </Button>
            )}
          </Flex>
        )}

        {upcomingLoans.length > 0 && (
          <div style={{ marginTop: 8 }} className="no-print">
            {upcomingLoans.map((loan) => (
              <Flex key={loan.id} align="center" gap={8} style={{ padding: '6px 12px', background: '#f0f5ff', borderRadius: 8, marginBottom: 4 }}>
                <SwapOutlined style={{ color: '#597ef7', flexShrink: 0, fontSize: 14 }} />
                <div style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12 }}>
                    Запланирован: {loan.toProfileName ?? '—'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {loan.startDate!.toLocaleDateString('ru-RU')}
                    {loan.dueDate && ` — ${loan.dueDate.toLocaleDateString('ru-RU')}`}
                    {loan.notes && ` · ${loan.notes}`}
                  </Text>
                </div>
                {canEdit && (
                  <Button size="small" type="text" danger onClick={async () => {
                    try {
                      await loanService.returnLoan(loan.id);
                      void loadOpenLoans();
                    } catch { void message.error('Ошибка'); }
                  }}>Отменить</Button>
                )}
              </Flex>
            ))}
          </div>
        )}

      </Card>

      {/* Предупреждение об отсутствии инв. номера */}
      {!equipment.invNumber && (
        <Alert
          type="warning"
          showIcon
          message="Инвентарный номер не указан"
          action={canEdit ? <Button size="small" onClick={onEdit}>Добавить</Button> : undefined}
          style={{ marginBottom: 16 }}
          className="no-print"
        />
      )}

      {/* Info */}
      <Card title="Информация" size="small" style={{ marginBottom: 16 }} className="no-print">
        <Descriptions column={{ xs: 1, sm: 1, md: 2 }} size="small">
          <Descriptions.Item label="Инвентарный №">
            {equipment.invNumber ? <Text code style={{ whiteSpace: 'nowrap' }}>{equipment.invNumber}</Text> : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Серийный №">
            <Text code style={{ whiteSpace: 'nowrap' }}>{equipment.serialNumber}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="ID в базе">
            <Text code style={{ whiteSpace: 'nowrap' }}>{equipment.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ответственный">{equipment.responsible}</Descriptions.Item>
          {equipment.roomId && rooms.length > 0 && (
            <Descriptions.Item label="Помещение" span={2}>
              {getRoomPath(rooms, equipment.roomId)}
            </Descriptions.Item>
          )}
          {project && (
            <Descriptions.Item label="Проект" span={2}>
              <Tag
                color="cyan"
                style={{ cursor: onProjectClick ? 'pointer' : 'default', whiteSpace: 'normal', wordBreak: 'break-word' }}
                onClick={() => onProjectClick?.(project)}
              >
                {project.name}
              </Tag>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Компоненты комплекта */}
      {components.length > 0 && (
        <Card title={`Компоненты (${components.length})`} size="small" style={{ marginBottom: 16 }} className="no-print">
          <Flex vertical gap={8}>
            {components.map((c) => (
              <Flex
                key={c.id}
                align="center"
                justify="space-between"
                gap={8}
                style={{ padding: '6px 10px', background: '#fafafa', borderRadius: 8, cursor: onComponentClick ? 'pointer' : 'default' }}
                onClick={() => onComponentClick?.(c)}
              >
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13 }}>{c.model}</Text>
                  {c.subtitle && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{c.subtitle}</Text>}
                </div>
                <Tag color={STATUS_COLOR[c.currentStatus]} style={{ margin: 0 }}>{c.currentStatus}</Tag>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      {/* Сборка */}
      {components.length > 0 && canEdit && (
        <Card title="Сборка" size="small" style={{ marginBottom: 16 }} className="no-print">
          <Flex align="center" justify="space-between" gap={8} wrap>
            <Tag color={ASSEMBLY_STATUS_COLOR[equipment.assemblyStatus ?? 'assembling']}>
              {ASSEMBLY_STATUS_LABEL[equipment.assemblyStatus ?? 'assembling']}
            </Tag>
            {(equipment.assemblyStatus ?? 'assembling') === 'assembling' && (
              <Button loading={assemblyLoading} onClick={() => void handleAssemblyStatusChange('ready')}>
                Готов к сверке
              </Button>
            )}
            {equipment.assemblyStatus === 'ready' && (
              <Button loading={assemblyLoading} onClick={() => void handleAssemblyStatusChange('assembling')}>
                Вернуть в сборку
              </Button>
            )}
          </Flex>
        </Card>
      )}

      {/* Accessories */}
      {equipment.accessories.length > 0 && (
        <Card title="Комплектация" size="small" style={{ marginBottom: 16 }} className="no-print">
          <Flex wrap gap={6}>
            {equipment.accessories.map((acc) => (
              <Tag key={acc} style={{ margin: 0 }}>
                {acc}
              </Tag>
            ))}
          </Flex>
        </Card>
      )}

      {/* Quantity */}
      {equipment.quantity != null && (
        <Card title="Количество" size="small" style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 20 }}>{equipment.quantity}</Text>
          <Text type="secondary" style={{ marginLeft: 6 }}>шт.</Text>
        </Card>
      )}

      {/* Attributes */}
      {equipment.attributes && Object.keys(equipment.attributes).length > 0 && (
        <Card title="Атрибуты" size="small" style={{ marginBottom: 16 }}>
          <Flex vertical gap={6}>
            {Object.entries(equipment.attributes).map(([key, value]) => (
              <Flex key={key} gap={8}>
                <Text type="secondary" style={{ minWidth: 100 }}>{key}</Text>
                <Text>{value}</Text>
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      {/* Status update */}
      {canEdit && (
        <Card title="Обновить статус" size="small" style={{ marginBottom: 16 }} className="no-print">
          {isMobile ? (
            <Flex vertical gap={8}>
              <Select<EquipmentStatus>
                value={status}
                onChange={handleStatusChange}
                style={{ width: '100%' }}
                options={STATUSES.map((s) => ({ label: s, value: s }))}
              />
              <Select<EquipmentLocation>
                value={location}
                onChange={setLocation}
                disabled={status === 'В Ремонте'}
                style={{ width: '100%' }}
                options={LOCATIONS.map((l) => ({ label: l, value: l }))}
              />
              <Input
                value={changedBy}
                onChange={(e) => setChangedBy(e.target.value)}
                placeholder="Кто меняет статус"
              />
              <Button type="primary" block onClick={() => void handleSave()}>
                Сохранить
              </Button>
            </Flex>
          ) : (
            <Space size={8} wrap>
              <Select<EquipmentStatus>
                value={status}
                onChange={handleStatusChange}
                style={{ width: 170 }}
                options={STATUSES.map((s) => ({ label: s, value: s }))}
              />
              <Select<EquipmentLocation>
                value={location}
                onChange={setLocation}
                disabled={status === 'В Ремонте'}
                style={{ width: 210 }}
                options={LOCATIONS.map((l) => ({ label: l, value: l }))}
              />
              <Input
                value={changedBy}
                onChange={(e) => setChangedBy(e.target.value)}
                placeholder="Кто меняет статус"
                style={{ width: 180 }}
              />
              <Button type="primary" onClick={() => void handleSave()}>
                Сохранить
              </Button>
            </Space>
          )}
        </Card>
      )}

      {/* History */}
      <Card title="История перемещений" size="small" className="no-print">
        <Table<HistoryEntry & { key: number }>
          dataSource={history.map((h, i) => ({ ...h, key: i }))}
          columns={historyColumns}
          size="small"
          pagination={false}
          scroll={{ x: 560 }}
        />
      </Card>

      {/* QR Modal */}
      {/* QR только для печати */}
      <div className="print-only" style={{ textAlign: 'center', padding: '40px 0' }}>
        <QRCodeSVG value={equipmentUrl} size={220} />
        <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>{equipment.model}</div>
        <div style={{ marginTop: 4, fontSize: 13, color: '#666' }}>
          {equipment.invNumber} · {equipment.id}
        </div>
      </div>

      {/* Модальное окно выдачи сотруднику */}
      <Modal
        title="Выдать сотруднику"
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        okText="Выдать"
        cancelText="Отмена"
        confirmLoading={assignLoading}
        onOk={async () => {
          if (!assignProfileId) { void message.error('Выберите сотрудника'); return; }
          const profile = profiles.find(p => p.id === assignProfileId);
          if (!profile) return;
          setAssignLoading(true);
          try {
            await assignmentService.assign(equipment.id, assignProfileId, equipment.currentLocation, assignNotes || undefined);
            setAssignOpen(false);
            void loadAssignment();
            void message.success(`Выдано: ${profile.name}`);
          } catch (error) {
            void message.error(getCustodyErrorMessage(error, 'Ошибка при выдаче'));
          } finally {
            setAssignLoading(false);
          }
        }}
      >
        <Flex vertical gap={12} style={{ marginTop: 8 }}>
          <Select
            placeholder="Выберите сотрудника"
            value={assignProfileId}
            onChange={setAssignProfileId}
            style={{ width: '100%' }}
            options={profiles.map(p => ({ value: p.id, label: `${p.name} (${p.email ?? p.role})` }))}
            showSearch
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <Input
            placeholder="Примечание (необязательно)"
            value={assignNotes}
            onChange={e => setAssignNotes(e.target.value)}
          />
        </Flex>
      </Modal>

      {/* Модальное окно временного займа */}
      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const loanStart = loanStartDate ? new Date(loanStartDate + 'T00:00:00') : today;
        const loanEnd = loanDueDate ? new Date(loanDueDate + 'T00:00:00') : null;
        const conflictProjects = (equipmentProjects ?? []).filter((p) => {
          const s = p.startDate, e = p.endDate;
          if (!s || !e) return false;
          if (!loanEnd) return e >= loanStart;
          return loanStart <= e && s <= loanEnd;
        });
        const conflictLoans = openLoans.filter((l) => {
          const ls = l.startDate ?? today;
          const le = l.dueDate;
          if (!le || !loanEnd) return true;
          return loanStart <= le && ls <= loanEnd;
        });
        const allConflictPeriods = [
          ...conflictProjects.map((p) =>
            `${p.startDate.toLocaleDateString('ru-RU')} — ${p.endDate.toLocaleDateString('ru-RU')}`
          ),
          ...conflictLoans.map((l) => {
            const s = (l.startDate ?? l.issuedAt).toLocaleDateString('ru-RU');
            return l.dueDate ? `${s} — ${l.dueDate.toLocaleDateString('ru-RU')}` : `с ${s}`;
          }),
        ];
        const blockedPeriods = allConflictPeriods.join(', ');
        const hasInvalidPeriod = !!loanEnd && loanEnd <= loanStart;
        const hasConflict = allConflictPeriods.length > 0 && !!loanDueDate;
        const hasSoftConflict = (conflictProjects.length > 0 || conflictLoans.some(l => !l.dueDate)) && !loanDueDate;
        return (
      <Modal
        title="Временный займ"
        open={loanOpen}
        onCancel={() => setLoanOpen(false)}
        okText="Оформить"
        cancelText="Отмена"
        confirmLoading={loanLoading}
        okButtonProps={{ disabled: hasConflict || hasInvalidPeriod }}
        onOk={async () => {
          if (!loanProfileId) {
            void message.error('Выберите сотрудника');
            return;
          }
          setLoanLoading(true);
          try {
            await loanService.create({
              equipmentId: equipment.id,
              loanType: 'employee',
              toProfileId: loanProfileId,
              currentLocation: equipment.currentLocation,
              startDate: loanStartDate || undefined,
              dueDate: loanDueDate || undefined,
              notes: loanNotes || undefined,
            });
            setLoanOpen(false);
            void loadOpenLoans();
            void message.success('Займ оформлен');
          } catch (error) {
            void message.error(getCustodyErrorMessage(error, 'Ошибка при оформлении займа'));
          } finally {
            setLoanLoading(false);
          }
        }}
      >
        <Flex vertical gap={12} style={{ marginTop: 8 }}>
          <Select
            placeholder="Выберите сотрудника"
            value={loanProfileId}
            onChange={setLoanProfileId}
            style={{ width: '100%' }}
            options={profiles.map((p) => ({ value: p.id, label: `${p.name} (${p.email ?? p.role})` }))}
            showSearch
            filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <Input
            type="date"
            placeholder="Дата начала (по умолчанию сегодня)"
            value={loanStartDate}
            onChange={(e) => setLoanStartDate(e.target.value)}
          />
          <Input
            type="date"
            placeholder="Дата возврата"
            value={loanDueDate}
            onChange={(e) => setLoanDueDate(e.target.value)}
          />
          {hasInvalidPeriod && (
            <Alert
              type="error"
              showIcon
              message="Дата возврата должна быть позже даты начала"
            />
          )}
          {hasConflict && (
            <Alert
              type="error"
              showIcon
              message="Оборудование недоступно в выбранный период"
              description={`Занято: ${blockedPeriods}. Укажите дату возврата до начала занятого периода.`}
            />
          )}
          {hasSoftConflict && (
            <Alert
              type="warning"
              showIcon
              message="Оборудование запланировано на проект"
              description={`Занятые периоды: ${blockedPeriods}. Укажите дату возврата до начала ближайшего периода.`}
            />
          )}
          <Input
            placeholder="Комментарий (необязательно)"
            value={loanNotes}
            onChange={(e) => setLoanNotes(e.target.value)}
          />
        </Flex>
      </Modal>
        );
      })()}

      <Modal
        title={`QR-код — ${equipment.model}`}
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        footer={null}
        centered
        width={320}
      >
        <Flex vertical align="center" gap={12} style={{ padding: '16px 0' }}>
          <QRCodeSVG value={equipmentUrl} size={200} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {equipment.id} · {equipment.invNumber}
          </Text>
          <Button
            icon={<CopyOutlined />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(equipmentUrl);
                void message.success('Ссылка скопирована');
              } catch {
                void message.error('Не удалось скопировать ссылку');
              }
            }}
          >
            Копировать ссылку
          </Button>
        </Flex>
      </Modal>
    </div>
  );
}
