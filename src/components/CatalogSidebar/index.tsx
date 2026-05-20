import { useState } from 'react';
import { Input, List, Avatar, Typography, Tag, Flex, Button, Select, Dropdown } from 'antd';
import { SearchOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  Equipment,
  EquipmentCategory,
  EquipmentStatus,
  EquipmentLocation,
} from '../../models/Equipment';

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

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  camera: 'Камера',
  microphone: 'Микрофон',
  light: 'Свет',
  computer: 'Компьютер',
  audio: 'Аудио',
  accessory: 'Аксессуар',
  optics: 'Оптика',
};

const STATUS_OPTIONS: Array<{ label: string; value: EquipmentStatus }> = [
  { label: 'В Работе', value: 'В Работе' },
  { label: 'На Складе', value: 'На Складе' },
  { label: 'В Ремонте', value: 'В Ремонте' },
  { label: 'Забронировано', value: 'Забронировано' },
  { label: 'Списано', value: 'Списано' },
  { label: 'В Пути', value: 'В Пути' },
];

const LOCATION_OPTIONS: Array<{ label: string; value: EquipmentLocation }> = [
  { label: 'Медиа Крыша', value: 'Студия Медиа Крыша' },
  { label: 'Романовом', value: 'Студия на Романовом' },
  { label: 'Склад', value: 'Склад' },
  { label: 'Ремонт', value: 'Ремонт' },
  { label: 'В пути', value: 'В пути' },
];

const SORT_OPTIONS = [
  { label: 'По умолчанию', value: 'default' },
  { label: 'Название А→Я', value: 'name_asc' },
  { label: 'Название Я→А', value: 'name_desc' },
  { label: 'По статусу', value: 'status' },
];

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'green',
  'На Складе': 'blue',
  'В Ремонте': 'orange',
  'Списано': 'red',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
  'Выдан': 'volcano',
};

function filterItems(
  items: Equipment[],
  category: EquipmentCategory | 'all',
  query: string,
  statusFilter: EquipmentStatus | 'all',
  locationFilter: EquipmentLocation | 'all',
): Equipment[] {
  const q = query.toLowerCase().trim();
  return items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch =
      !q || item.model.toLowerCase().includes(q) || item.invNumber.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || item.currentStatus === statusFilter;
    const matchesLocation = locationFilter === 'all' || item.currentLocation === locationFilter;
    return matchesCategory && matchesSearch && matchesStatus && matchesLocation;
  });
}

function sortItems(items: Equipment[], sortBy: string): Equipment[] {
  const arr = [...items];
  if (sortBy === 'name_asc') return arr.sort((a, b) => a.model.localeCompare(b.model, 'ru'));
  if (sortBy === 'name_desc') return arr.sort((a, b) => b.model.localeCompare(a.model, 'ru'));
  if (sortBy === 'status') return arr.sort((a, b) => a.currentStatus.localeCompare(b.currentStatus, 'ru'));
  return arr;
}

function toRows(items: Equipment[]) {
  return items.map((item) => ({
    'Инв. номер': item.invNumber,
    'Модель': item.model,
    'Категория': CATEGORY_LABEL[item.category],
    'Статус': item.currentStatus,
    'Локация': item.currentLocation,
    'Ответственный': item.responsible,
    'Серийный номер': item.serialNumber,
    'Дата обновления': item.history[0]?.date.toLocaleString('ru-RU') ?? '',
  }));
}

function exportCsv(items: Equipment[]) {
  const rows = toRows(items);
  const headers = Object.keys(rows[0] ?? {});
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equipment-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(items: Equipment[]) {
  const equipmentRows = toRows(items);
  const wsEquipment = XLSX.utils.json_to_sheet(equipmentRows);
  wsEquipment['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
  ];

  const historyRows = items.flatMap((item) =>
    item.history.map((h) => ({
      'Инв. номер': item.invNumber,
      'Модель': item.model,
      'Дата': h.date.toLocaleString('ru-RU'),
      'Статус': h.status,
      'Локация': h.location,
      'Ответственный': h.responsible,
    }))
  );
  const wsHistory = XLSX.utils.json_to_sheet(historyRows);
  wsHistory['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsEquipment, 'Оборудование');
  XLSX.utils.book_append_sheet(wb, wsHistory, 'История');
  XLSX.writeFile(wb, `equipment-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

interface Props {
  items: Equipment[];
  selected: Equipment | null;
  canEdit: boolean;
  onSelect: (equipment: Equipment) => void;
  onAdd: () => void;
}

export function CatalogSidebar({ items, selected, canEdit, onSelect, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState<EquipmentLocation | undefined>(undefined);
  const [sortBy, setSortBy] = useState('default');

  const hasActiveFilters = !!statusFilter || !!locationFilter || sortBy !== 'default';

  const statusVal: EquipmentStatus | 'all' = statusFilter ?? 'all';
  const locationVal: EquipmentLocation | 'all' = locationFilter ?? 'all';

  const filtered = sortItems(filterItems(items, category, query, statusVal, locationVal), sortBy);

  const handleReset = () => {
    setStatusFilter(undefined);
    setLocationFilter(undefined);
    setSortBy('default');
  };

  const exportMenuItems = [
    {
      key: 'csv',
      label: 'Экспорт CSV',
      onClick: () => exportCsv(filtered),
      disabled: filtered.length === 0,
    },
    {
      key: 'excel',
      label: 'Экспорт Excel',
      onClick: () => exportExcel(filtered),
      disabled: filtered.length === 0,
    },
  ];

  return (
    <Flex vertical style={{ height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Text strong style={{ fontSize: 15 }}>
            Оборудование
          </Text>
          <Flex gap={6}>
            <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
              <Button size="small" icon={<DownloadOutlined />} disabled={items.length === 0} />
            </Dropdown>
            {canEdit && (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
                Добавить
              </Button>
            )}
          </Flex>
        </Flex>
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Модель или INV-номер..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          size="small"
          style={{ marginBottom: 8 }}
        />
        <Flex gap={6} style={{ marginBottom: 6 }}>
          <Select<EquipmentStatus>
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Статус"
            allowClear
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={STATUS_OPTIONS}
          />
          <Select<EquipmentLocation>
            size="small"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Локация"
            allowClear
            value={locationFilter}
            onChange={(v) => setLocationFilter(v)}
            options={LOCATION_OPTIONS}
          />
        </Flex>
        <Flex gap={6} align="center">
          <Select
            size="small"
            style={{ flex: 1 }}
            value={sortBy}
            onChange={setSortBy}
            options={SORT_OPTIONS}
          />
          {hasActiveFilters && (
            <Button
              size="small"
              type="link"
              onClick={handleReset}
              style={{ padding: '0 4px', fontSize: 12, flexShrink: 0 }}
            >
              Сбросить
            </Button>
          )}
        </Flex>
      </div>

      {/* Category list */}
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>
        {CATEGORIES.map((c) => {
          const count = filterItems(items, c.value, query, statusVal, locationVal).length;
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
