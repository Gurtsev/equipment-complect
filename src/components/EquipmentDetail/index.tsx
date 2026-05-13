import { useState } from 'react';
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
} from 'antd';
import { QrcodeOutlined, EditOutlined, PrinterOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import {
  Equipment,
  EquipmentStatus,
  EquipmentLocation,
  HistoryEntry,
} from '../../models/Equipment';
import { Project } from '../../models/Project';

const { Title, Text } = Typography;

// 'Забронировано' не включён — статус проставляется только через проекты
const STATUSES: EquipmentStatus[] = ['В Работе', 'На Складе', 'В Ремонте', 'Списано', 'В Пути'];
const LOCATIONS: EquipmentLocation[] = [
  'Студия Медиа Крыша',
  'Студия на Романовом',
  'Склад',
  'Ремонт',
  'В пути',
];

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'success',
  'На Складе': 'processing',
  'В Ремонте': 'warning',
  'Списано': 'error',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
};

const CATEGORY_LABEL: Record<Equipment['category'], string> = {
  camera: 'Камера',
  microphone: 'Микрофон',
  light: 'Свет',
  computer: 'Компьютер',
  audio: 'Аудио',
  accessory: 'Аксессуар',
  optics: 'Оптика',
};

const CATEGORY_COLOR: Record<Equipment['category'], string> = {
  camera: 'blue',
  microphone: 'magenta',
  light: 'gold',
  computer: 'green',
  audio: 'purple',
  accessory: 'default',
  optics: 'cyan',
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
];

interface Props {
  equipment: Equipment;
  canEdit: boolean;
  onEdit: () => void;
  project?: Project | null;
  onProjectClick?: (project: Project) => void;
  onStatusUpdate?: (status: EquipmentStatus, location: EquipmentLocation, responsible: string) => Promise<void>;
}

export function EquipmentDetail({ equipment, canEdit, onEdit, project, onProjectClick, onStatusUpdate }: Props) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<EquipmentStatus>(equipment.currentStatus);
  const [location, setLocation] = useState<EquipmentLocation>(equipment.currentLocation);
  const [changedBy, setChangedBy] = useState(equipment.responsible);
  const [history, setHistory] = useState<HistoryEntry[]>(equipment.history);
  const [qrOpen, setQrOpen] = useState(false);

  const handleStatusChange = (val: EquipmentStatus) => {
    setStatus(val);
    if (val === 'В Ремонте') setLocation('Ремонт');
  };

  const handleSave = async () => {
    equipment.addHistoryEntry(status, location, changedBy);
    setHistory([...equipment.history]);
    await onStatusUpdate?.(status, location, changedBy);
    void message.success('Статус обновлён');
  };

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      {/* Header card */}
      <Card style={{ marginBottom: 16 }}>
        <Flex gap={20} align="flex-start">
          <div
            className="equipment-image"
            style={{
              width: 180,
              height: 130,
              backgroundImage: `url('${equipment.image}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
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
            </Flex>
            <Title level={4} style={{ margin: '0 0 2px' }}>
              {equipment.model}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {equipment.subtitle}
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 13 }}>{equipment.description}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              📍 {equipment.currentLocation}
            </Text>
          </div>
          <Flex gap={8} className="no-print">
            {canEdit && (
              <Button icon={<EditOutlined />} onClick={onEdit}>
                Изменить
              </Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Печать
            </Button>
            <Button icon={<QrcodeOutlined />} onClick={() => setQrOpen(true)}>
              QR-код
            </Button>
          </Flex>
        </Flex>

        {/* QR для печати */}
        <div className="print-only" style={{ marginTop: 16, textAlign: 'center' }}>
          <QRCodeSVG value={`equipment:${equipment.id}`} size={120} />
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            {equipment.id} · {equipment.invNumber}
          </div>
        </div>
      </Card>

      {/* Info */}
      <Card title="Информация" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Инвентарный №">
            <Text code>{equipment.invNumber}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Серийный №">
            <Text code>{equipment.serialNumber}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="ID в базе">
            <Text code>{equipment.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ответственный">{equipment.responsible}</Descriptions.Item>
          {project && (
            <Descriptions.Item label="Проект" span={2}>
              <Flex align="center" gap={8}>
                <Tag color="cyan">{project.name}</Tag>
                {onProjectClick && (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto', fontSize: 12 }}
                    onClick={() => onProjectClick(project)}
                  >
                    Перейти →
                  </Button>
                )}
              </Flex>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Accessories */}
      <Card title="Комплектация" size="small" style={{ marginBottom: 16 }}>
        <Flex wrap gap={6}>
          {equipment.accessories.map((acc) => (
            <Tag key={acc} style={{ margin: 0 }}>
              {acc}
            </Tag>
          ))}
        </Flex>
      </Card>

      {/* Status update */}
      {canEdit && <Card title="Обновить статус" size="small" style={{ marginBottom: 16 }} className="no-print">
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
      </Card>}

      {/* History */}
      <Card title="История перемещений" size="small">
        <Table<HistoryEntry & { key: number }>
          dataSource={history.map((h, i) => ({ ...h, key: i }))}
          columns={historyColumns}
          size="small"
          pagination={false}
        />
      </Card>

      {/* QR Modal */}
      <Modal
        title={`QR-код — ${equipment.model}`}
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        footer={null}
        centered
        width={320}
      >
        <Flex vertical align="center" gap={12} style={{ padding: '16px 0' }}>
          <QRCodeSVG value={`equipment:${equipment.id}`} size={200} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {equipment.id} · {equipment.invNumber}
          </Text>
        </Flex>
      </Modal>
    </div>
  );
}
