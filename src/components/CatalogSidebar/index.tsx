import { useState } from 'react';
import { Input, List, Avatar, Typography, Tag, Flex, Button } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { Equipment, EquipmentCategory, EquipmentStatus } from '../../models/Equipment';

const { Text } = Typography;

const CATEGORIES: Array<{ label: string; value: EquipmentCategory | 'all' }> = [
  { label: 'Все категории', value: 'all' },
  { label: 'Камеры', value: 'camera' },
  { label: 'Микрофоны', value: 'microphone' },
  { label: 'Свет', value: 'light' },
  { label: 'Компьютеры', value: 'computer' },
  { label: 'Аудио', value: 'audio' },
  { label: 'Аксессуары', value: 'accessory' },
  { label: 'Оптика', value: 'optics' },
];

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'green',
  'На Складе': 'blue',
  'В Ремонте': 'orange',
  'Списано': 'red',
  'В Пути': 'purple',
};

function filterItems(
  items: Equipment[],
  category: EquipmentCategory | 'all',
  query: string,
): Equipment[] {
  const q = query.toLowerCase().trim();
  return items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch =
      !q || item.model.toLowerCase().includes(q) || item.invNumber.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
}

interface Props {
  items: Equipment[];
  selected: Equipment | null;
  onSelect: (equipment: Equipment) => void;
  onAdd: () => void;
}

export function CatalogSidebar({ items, selected, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');

  const filtered = filterItems(items, category, query);

  return (
    <Flex vertical style={{ height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Text strong style={{ fontSize: 15 }}>
            Оборудование
          </Text>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
            Добавить
          </Button>
        </Flex>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Модель или INV-номер..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* Category list */}
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>
        {CATEGORIES.map((c) => {
          const count = filterItems(items, c.value, query).length;
          const isActive = category === c.value;
          return (
            <div
              key={c.value}
              onClick={() => setCategory(c.value)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 16px',
                cursor: 'pointer',
                background: isActive ? '#e6f4ff' : 'transparent',
                borderLeft: `3px solid ${isActive ? '#1677ff' : 'transparent'}`,
                transition: 'background 0.15s',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: isActive ? '#1677ff' : undefined,
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {c.label}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {count}
              </Text>
            </div>
          );
        })}
      </div>

      {/* List */}
      <List
        style={{ flex: 1, overflowY: 'auto' }}
        dataSource={filtered}
        locale={{ emptyText: items.length === 0 ? 'Каталог пуст' : 'Ничего не найдено' }}
        renderItem={(item) => {
          const isSelected = selected?.id === item.id;
          return (
            <List.Item
              key={item.id}
              onClick={() => onSelect(item)}
              style={{
                cursor: 'pointer',
                padding: '10px 16px',
                background: isSelected ? '#e6f4ff' : 'transparent',
                borderLeft: `3px solid ${isSelected ? '#1677ff' : 'transparent'}`,
                transition: 'background 0.15s',
                alignItems: 'flex-start',
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={item.image}
                    shape="square"
                    size={44}
                    style={{ borderRadius: 6, flexShrink: 0 }}
                  />
                }
                title={
                  <Text strong style={{ fontSize: 12, lineHeight: '16px' }}>
                    {item.model}
                  </Text>
                }
                description={
                  <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>
                      {item.subtitle}
                    </div>
                    <Flex gap={4} align="center" wrap>
                      <Tag
                        color={STATUS_COLOR[item.currentStatus]}
                        style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}
                      >
                        {item.currentStatus}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {item.invNumber}
                      </Text>
                    </Flex>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    </Flex>
  );
}
