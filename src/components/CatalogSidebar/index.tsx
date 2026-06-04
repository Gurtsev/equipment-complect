import { useState, useEffect, useMemo } from 'react';
import { Input, List, Avatar, Typography, Tag, Flex, Button, Select, Dropdown, TreeSelect, Grid, Badge } from 'antd';
import { SearchOutlined, PlusOutlined, DownloadOutlined, FilterOutlined, AppstoreOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  Equipment,
  EquipmentCategory,
  EquipmentSection,
  EquipmentStatus,
  EquipmentLocation,
} from '../../models/Equipment';
import { buildRoomTree, OFFICE_LABEL } from '../../services/roomService';
import type { Room, RoomTreeNode } from '../../services/roomService';

const { Text } = Typography;

const SECTION_OPTIONS: Array<{ label: string; value: EquipmentSection | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Техника', value: 'tech' },
  { label: 'Мебель', value: 'furniture' },
  { label: 'Реквизит', value: 'prop' },
];

const CATEGORIES_BY_SECTION: Record<EquipmentSection | 'all', Array<{ label: string; value: EquipmentCategory | 'all' }>> = {
  all: [
    { label: 'Все категории', value: 'all' },
    { label: 'Камеры', value: 'camera' },
    { label: 'Микрофоны', value: 'microphone' },
    { label: 'Свет', value: 'light' },
    { label: 'Компьютеры', value: 'computer' },
    { label: 'Аудио', value: 'audio' },
    { label: 'Оптика', value: 'optics' },
    { label: 'Телефоны', value: 'phone' },
    { label: 'Инструмент', value: 'tool' },
    { label: 'Аксессуары', value: 'accessory' },
    { label: 'Мебель', value: 'furniture' },
    { label: 'Реквизит', value: 'prop' },
  ],
  tech: [
    { label: 'Все категории', value: 'all' },
    { label: 'Камеры', value: 'camera' },
    { label: 'Микрофоны', value: 'microphone' },
    { label: 'Свет', value: 'light' },
    { label: 'Компьютеры', value: 'computer' },
    { label: 'Аудио', value: 'audio' },
    { label: 'Оптика', value: 'optics' },
    { label: 'Телефоны', value: 'phone' },
    { label: 'Инструмент', value: 'tool' },
    { label: 'Аксессуары', value: 'accessory' },
  ],
  furniture: [
    { label: 'Все категории', value: 'all' },
    { label: 'Мебель', value: 'furniture' },
  ],
  prop: [
    { label: 'Все категории', value: 'all' },
    { label: 'Реквизит', value: 'prop' },
    { label: 'Аксессуары', value: 'accessory' },
  ],
};

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  camera: 'Камера',
  microphone: 'Микрофон',
  light: 'Свет',
  computer: 'Компьютер',
  audio: 'Аудио',
  accessory: 'Аксессуар',
  optics: 'Оптика',
  phone: 'Телефон',
  furniture: 'Мебель',
  prop: 'Реквизит',
  tool: 'Инструмент',
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
  { label: 'Склад', value: 'Склад' },
  { label: 'Ремонт', value: 'Ремонт' },
  { label: 'В пути', value: 'В пути' },
  { label: 'На руках', value: 'На руках' },
  { label: 'Офис', value: 'Офис' },
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

// ── Room filter helpers ──────────────────────────────────────────────────────

function toFilterTreeData(nodes: RoomTreeNode[]): object[] {
  return nodes.map((n) => ({
    title: n.name,
    value: n.id,
    key: n.id,
    children: n.children.length > 0 ? toFilterTreeData(n.children) : undefined,
  }));
}

function buildFilterOfficeTree(rooms: Room[]): object[] {
  const offices = ['A', 'B', 'C'] as const;
  return offices
    .filter((office) => rooms.some((r) => r.office === office))
    .map((office) => {
      const officeRooms = rooms.filter((r) => r.office === office);
      const tree = buildRoomTree(officeRooms);
      return {
        title: OFFICE_LABEL[office],
        value: `office-${office}`,
        key: `office-${office}`,
        children: toFilterTreeData(tree),
      };
    });
}

function getRoomFilterIds(rooms: Room[], selectedValue: string): Set<string> {
  if (selectedValue.startsWith('office-')) {
    const office = selectedValue.replace('office-', '');
    return new Set(rooms.filter((r) => r.office === office).map((r) => r.id));
  }
  const result = new Set<string>();
  const queue = [selectedValue];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    rooms.filter((r) => r.parentId === id).forEach((r) => queue.push(r.id));
  }
  return result;
}

// ── Filter / sort ────────────────────────────────────────────────────────────

function filterItems(
  items: Equipment[],
  category: EquipmentCategory | 'all',
  query: string,
  statusFilter: EquipmentStatus | 'all',
  locationFilter: EquipmentLocation | 'all',
  sectionFilter: EquipmentSection | 'all',
  roomIds: Set<string> | null,
): Equipment[] {
  const q = query.toLowerCase().trim();
  return items.filter((item) => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch =
      !q || item.model.toLowerCase().includes(q) || item.invNumber.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || item.currentStatus === statusFilter;
    const matchesLocation = locationFilter === 'all' || item.currentLocation === locationFilter;
    const matchesSection = sectionFilter === 'all' || item.section === sectionFilter;
    const matchesRoom = !roomIds || (item.roomId != null && roomIds.has(item.roomId));
    return matchesCategory && matchesSearch && matchesStatus && matchesLocation && matchesSection && matchesRoom;
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
  onSwitchToGrid: () => void;
  onFilteredItemsChange?: (items: Equipment[]) => void;
  viewMode?: 'list' | 'grid';
  rooms?: Room[];
}

export function CatalogSidebar({ items, selected, canEdit, onSelect, onAdd, onSwitchToGrid, onFilteredItemsChange, viewMode = 'list', rooms = [] }: Props) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState<EquipmentLocation | undefined>(undefined);
  const [sectionFilter, setSectionFilter] = useState<EquipmentSection | 'all'>('all');
  const [sortBy, setSortBy] = useState('default');
  const [roomFilter, setRoomFilter] = useState<string | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(true);

  useEffect(() => {
    setFiltersOpen(!isMobile);
  }, [isMobile]);

  const hasActiveFilters = !!statusFilter || !!locationFilter || sortBy !== 'default' || !!roomFilter;

  const statusVal: EquipmentStatus | 'all' = statusFilter ?? 'all';
  const locationVal: EquipmentLocation | 'all' = locationFilter ?? 'all';
  const roomIds = useMemo(
    () => roomFilter ? getRoomFilterIds(rooms, roomFilter) : null,
    [roomFilter, rooms],
  );

  const currentCategories = CATEGORIES_BY_SECTION[sectionFilter];
  const visibleCategories = currentCategories.filter((c) => {
    if (c.value === 'all') return true;
    return filterItems(items, c.value, query, statusVal, locationVal, sectionFilter, roomIds).length > 0;
  });

  useEffect(() => {
    if (category === 'all') return;
    const count = filterItems(items, category, query, statusVal, locationVal, sectionFilter, roomIds).length;
    if (count === 0) setCategory('all');
  }, [sectionFilter, roomFilter, items]);

  const filtered = useMemo(
    () => sortItems(filterItems(items, category, query, statusVal, locationVal, sectionFilter, roomIds), sortBy),
    [items, category, query, statusVal, locationVal, sectionFilter, roomIds, sortBy],
  );

  useEffect(() => {
    onFilteredItemsChange?.(filtered);
  }, [filtered, onFilteredItemsChange]);

  const handleReset = () => {
    setStatusFilter(undefined);
    setLocationFilter(undefined);
    setSortBy('default');
    setRoomFilter(undefined);
  };

  const sectionFilterStyle = (val: EquipmentSection | 'all'): React.CSSProperties => ({
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    cursor: 'pointer',
    userSelect: 'none',
    background: sectionFilter === val ? '#1677ff' : '#f0f0f0',
    color: sectionFilter === val ? '#fff' : '#595959',
    transition: 'all 0.15s',
    flexShrink: 0,
  });

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
      <div style={{ padding: '12px 16px', borderBottom: filtersOpen ? 'none' : '1px solid #f0f0f0' }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: filtersOpen ? 10 : 0 }}>
          <Text strong style={{ fontSize: 15 }}>
            Оборудование
          </Text>
          <Flex gap={6}>
            {isMobile && (
              <Badge dot={hasActiveFilters} offset={[-2, 2]}>
                <Button
                  size="small"
                  icon={<FilterOutlined />}
                  onClick={() => setFiltersOpen((v) => !v)}
                  type={filtersOpen ? 'primary' : 'default'}
                />
              </Badge>
            )}
            <Button size="small" icon={<AppstoreOutlined />} onClick={onSwitchToGrid} title="Сетка" />
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

        {filtersOpen && (
          <div style={{ borderTop: isMobile ? '1px solid #f0f0f0' : 'none', paddingTop: isMobile ? 10 : 0 }}>
            <Flex gap={6} wrap="wrap" style={{ marginBottom: 8 }}>
              {SECTION_OPTIONS.map((s) => (
                <span key={s.value} style={sectionFilterStyle(s.value)} onClick={() => { setSectionFilter(s.value); setCategory('all'); }}>
                  {s.label}
                </span>
              ))}
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
            {rooms.length > 0 && (
              <TreeSelect
                size="small"
                style={{ width: '100%', marginBottom: 6 }}
                placeholder="Помещение"
                treeData={buildFilterOfficeTree(rooms)}
                value={roomFilter}
                onChange={(v) => setRoomFilter(v)}
                allowClear
                showSearch
                treeNodeFilterProp="title"
                treeDefaultExpandAll={false}
              />
            )}
            <Flex gap={6} align="center" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
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
        )}

        {!filtersOpen && (
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Модель или INV-номер..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            size="small"
            style={{ marginTop: 8, marginBottom: 4 }}
          />
        )}
      </div>

      {/* Category list */}
      <div style={{ borderBottom: '1px solid #f0f0f0', padding: '4px 0' }}>
        {visibleCategories.map((c) => {
          const count = filterItems(items, c.value, query, statusVal, locationVal, sectionFilter, roomIds).length;
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

      {/* List — скрыт в режиме сетки */}
      <List
        style={{ flex: 1, overflowY: 'auto', display: viewMode === 'grid' ? 'none' : undefined }}
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
                      {item.invNumber ? (
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          {item.invNumber}
                        </Text>
                      ) : (
                        <Tag color="orange" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>
                          Без инв. №
                        </Tag>
                      )}
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
