import { Card, Col, Row, Statistic, Tag, Typography, Flex } from 'antd';
import {
  Equipment,
  EquipmentStatus,
  EquipmentCategory,
  EquipmentLocation,
} from '../../models/Equipment';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'green',
  'На Складе': 'blue',
  'В Ремонте': 'orange',
  'Списано': 'red',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
  'Выдан': 'volcano',
};

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  camera: 'Камеры',
  microphone: 'Микрофоны',
  light: 'Свет',
  computer: 'Компьютеры',
  audio: 'Аудио',
  accessory: 'Аксессуары',
  optics: 'Оптика',
};

const STATUSES: EquipmentStatus[] = ['В Работе', 'Забронировано', 'На Складе', 'В Ремонте', 'В Пути', 'Списано'];
const CATEGORIES: EquipmentCategory[] = ['camera', 'microphone', 'light', 'computer', 'audio', 'accessory', 'optics'];
const LOCATIONS: EquipmentLocation[] = ['Студия Медиа Крыша', 'Студия на Романовом', 'Склад', 'Ремонт', 'В пути'];

interface Props {
  items: Equipment[];
}

export function Dashboard({ items }: Props) {
  const countByStatus = (status: EquipmentStatus) =>
    items.filter((i) => i.currentStatus === status).length;

  const countByCategory = (cat: EquipmentCategory) =>
    items.filter((i) => i.category === cat).length;

  const countByLocation = (loc: EquipmentLocation) =>
    items.filter((i) => i.currentLocation === loc).length;

  if (items.length === 0) {
    return (
      <Flex
        vertical
        align="center"
        justify="center"
        style={{ height: '100%', gap: 8 }}
      >
        <span style={{ fontSize: 48 }}>📋</span>
        <Text type="secondary" style={{ fontSize: 16 }}>
          Каталог пуст — добавьте первое оборудование
        </Text>
      </Flex>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 20 }}>
        Обзор инвентаря
      </Title>

      {/* Итого */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card size="small">
            <Statistic title="Всего единиц оборудования" value={items.length} />
          </Card>
        </Col>
      </Row>

      {/* По статусам */}
      <Card title="По статусу" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {STATUSES.map((status) => {
            const count = countByStatus(status);
            if (count === 0) return null;
            return (
              <Col key={status} xs={12} sm={8} md={6}>
                <Flex align="center" gap={8}>
                  <Tag color={STATUS_COLOR[status]} style={{ margin: 0 }}>
                    {status}
                  </Tag>
                  <Text strong>{count}</Text>
                </Flex>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* По категориям */}
      <Card title="По категориям" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          {CATEGORIES.map((cat) => {
            const count = countByCategory(cat);
            if (count === 0) return null;
            return (
              <Col key={cat} xs={12} sm={8} md={6}>
                <Flex align="center" gap={8}>
                  <Text style={{ fontSize: 13 }}>{CATEGORY_LABEL[cat]}</Text>
                  <Text strong>{count}</Text>
                </Flex>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* По локациям */}
      <Card title="По локациям" size="small">
        <Row gutter={[12, 12]}>
          {LOCATIONS.map((loc) => {
            const count = countByLocation(loc);
            if (count === 0) return null;
            return (
              <Col key={loc} xs={12} sm={8}>
                <Flex align="center" gap={8}>
                  <Text style={{ fontSize: 13 }}>📍 {loc}</Text>
                  <Text strong>{count}</Text>
                </Flex>
              </Col>
            );
          })}
        </Row>
      </Card>
    </div>
  );
}
