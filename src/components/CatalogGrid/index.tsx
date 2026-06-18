import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Button, Modal, App, Drawer, Select, Badge, TreeSelect, Tag, List, Typography } from 'antd';
import { SearchOutlined, PlusOutlined, FilterOutlined, RightOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { EquipmentCard, CATEGORY_SVG } from '../EquipmentCard';
import { EquipmentDetail } from '../EquipmentDetail';
import { historyService } from '../../services/historyService';
import { buildRoomTree, OFFICE_LABEL } from '../../services/roomService';
import type { AssemblyStatus, Equipment, EquipmentStatus, EquipmentLocation, EquipmentSection, EquipmentCategory } from '../../models/Equipment';
import type { Project } from '../../models/Project';
import type { Room } from '../../services/roomService';

// ── Constants ────────────────────────────────────────────────────────────────

const SECTION_TABS: Array<{ label: string; value: EquipmentSection | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Техника', value: 'tech' },
  { label: 'Мебель', value: 'furniture' },
  { label: 'Реквизит', value: 'prop' },
];

const CATEGORIES_BY_SECTION: Record<EquipmentSection | 'all', Array<{ label: string; value: EquipmentCategory | 'all' }>> = {
  all: [
    { label: 'Все', value: 'all' },
    { label: 'Камеры', value: 'camera' },
    { label: 'Микрофоны', value: 'microphone' },
    { label: 'Свет', value: 'light' },
    { label: 'Компьютеры', value: 'computer' },
    { label: 'Ноутбуки', value: 'laptop' },
    { label: 'Телевизоры', value: 'tv' },
    { label: 'Аудио', value: 'audio' },
    { label: 'Оптика', value: 'optics' },
    { label: 'Телефоны', value: 'phone' },
    { label: 'Инструмент', value: 'tool' },
    { label: 'Аксессуары', value: 'accessory' },
    { label: 'Мебель', value: 'furniture' },
    { label: 'Реквизит', value: 'prop' },
  ],
  tech: [
    { label: 'Все', value: 'all' },
    { label: 'Камеры', value: 'camera' },
    { label: 'Микрофоны', value: 'microphone' },
    { label: 'Свет', value: 'light' },
    { label: 'Компьютеры', value: 'computer' },
    { label: 'Ноутбуки', value: 'laptop' },
    { label: 'Телевизоры', value: 'tv' },
    { label: 'Аудио', value: 'audio' },
    { label: 'Оптика', value: 'optics' },
    { label: 'Телефоны', value: 'phone' },
    { label: 'Инструмент', value: 'tool' },
    { label: 'Аксессуары', value: 'accessory' },
  ],
  furniture: [{ label: 'Все', value: 'all' }, { label: 'Мебель', value: 'furniture' }],
  prop: [{ label: 'Все', value: 'all' }, { label: 'Реквизит', value: 'prop' }, { label: 'Аксессуары', value: 'accessory' }],
};

const STATUS_OPTIONS: Array<{ label: string; value: EquipmentStatus }> = [
  { label: 'В Работе', value: 'В Работе' },
  { label: 'На Складе', value: 'На Складе' },
  { label: 'В Ремонте', value: 'В Ремонте' },
  { label: 'Выдан', value: 'Выдан' },
  { label: 'В Пути', value: 'В Пути' },
  { label: 'Списано', value: 'Списано' },
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

// ── Room filter helpers ───────────────────────────────────────────────────────

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

function buildFilterOfficeTree(rooms: Room[]): object[] {
  const offices = ['A', 'B', 'C'] as const;
  return offices
    .filter((o) => rooms.some((r) => r.office === o))
    .map((o) => {
      const tree = buildRoomTree(rooms.filter((r) => r.office === o));
      const toNodes = (nodes: ReturnType<typeof buildRoomTree>): object[] =>
        nodes.map((n) => ({ title: n.name, value: n.id, key: n.id, children: n.children.length ? toNodes(n.children) : undefined }));
      return { title: OFFICE_LABEL[o], value: `office-${o}`, key: `office-${o}`, children: toNodes(tree) };
    });
}

const STATUS_DOT_COLOR: Record<string, string> = {
  'В Работе': '#52c41a',
  'На Складе': '#1677ff',
  'В Ремонте': '#fa8c16',
  'Списано': '#ff4d4f',
  'В Пути': '#722ed1',
  'Забронировано': '#13c2c2',
  'Выдан': '#fa541c',
};

// ── ModelCard ─────────────────────────────────────────────────────────────────

function ModelCard({ group, onClick, onAddToCart }: {
  group: Equipment[];
  onClick: () => void;
  onAddToCart?: () => void;
}) {
  const first = group[0];
  const image = group.find((e) => e.image)?.image ?? null;

  const statusCounts = group.reduce<Record<string, number>>((acc, eq) => {
    acc[eq.currentStatus] = (acc[eq.currentStatus] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid #f0f0f0',
        transition: 'box-shadow 0.18s, border-color 0.18s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.borderColor = '#d9d9d9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#f0f0f0'; }}
    >
      {group.length > 1 && (
        <div style={{
          position: 'absolute', top: 6, right: 6, zIndex: 2,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600,
        }}>
          {group.length} шт.
        </div>
      )}

      <div style={{ position: 'relative', paddingTop: '66%', background: '#f5f5f5', flexShrink: 0 }}>
        {image ? (
          <img src={image} alt={first.model} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {CATEGORY_SVG[first.category] ?? (
              <svg viewBox="0 0 80 80" width="64" height="64">
                <rect x="14" y="14" width="52" height="52" rx="8" fill="#e8e8e8" stroke="#bfbfbf" strokeWidth={2.5} />
              </svg>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {first.model}
        </div>
        {first.subtitle && (
          <div style={{ fontSize: 12, color: '#8c8c8c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
            {first.subtitle}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} style={{ fontSize: 11, color: STATUS_DOT_COLOR[status] ?? '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9 }}>●</span> {count} {status}
            </span>
          ))}
        </div>
      </div>

      {group.length > 1 && (
        <div style={{ padding: '6px 12px', borderTop: '1px solid #f5f5f5', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, fontSize: 12, color: '#1677ff' }}>
          Все единицы <RightOutlined style={{ fontSize: 10 }} />
        </div>
      )}

      {onAddToCart && group.length === 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
          style={{ position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#52c41a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, boxShadow: '0 2px 6px rgba(82,196,26,0.4)', zIndex: 2 }}
          title="В корзину"
        >
          <ShoppingCartOutlined />
        </button>
      )}
    </div>
  );
}

// ── Chip style ───────────────────────────────────────────────────────────────

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '3px 12px',
  borderRadius: 14,
  border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
  background: active ? '#e6f4ff' : '#fff',
  color: active ? '#1677ff' : '#595959',
  fontWeight: active ? 600 : 400,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  transition: 'all 0.15s',
  userSelect: 'none',
});

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  items: Equipment[];
  canEdit: boolean;
  isAdmin?: boolean;
  onAdd: () => void;
  onEdit: (eq: Equipment) => void;
  onDelete?: (eq: Equipment) => Promise<void>;
  onDuplicate?: (eq: Equipment) => void;
  onAddToCart?: (equipmentId: string) => Promise<void>;
  showControls?: boolean;
  rooms: Room[];
  projects: Project[];
  getEquipmentProject: (id: string) => Project | undefined;
  getEquipmentProjects: (id: string) => Project[];
  onProjectClick: (project: Project) => void;
  onEquipmentChange: () => Promise<void>;
  detailKey: number;
  allEquipment: Equipment[];
  onDetach?: (eq: Equipment) => Promise<void>;
  onAssemblyStatusChange?: (eq: Equipment, status: AssemblyStatus) => Promise<void>;
}

export function CatalogGrid({
  items,
  canEdit,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
  onAddToCart,
  showControls = true,
  rooms,
  getEquipmentProject,
  getEquipmentProjects,
  onProjectClick,
  onEquipmentChange,
  detailKey,
  allEquipment,
  onDetach,
  onAssemblyStatusChange,
}: Props) {
  const { message } = App.useApp();

  // Modal state
  const [modalEquipment, setModalEquipment] = useState<Equipment | null>(null);
  const [modalKey, setModalKey] = useState(0);

  // Group drawer state
  const [groupDrawerModel, setGroupDrawerModel] = useState<string | null>(null);

  // Mobile filter state (only used when showControls=true)
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<EquipmentSection | 'all'>('all');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | undefined>(undefined);
  const [locationFilter, setLocationFilter] = useState<EquipmentLocation | undefined>(undefined);
  const [roomFilter, setRoomFilter] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState('default');
  const [filterOpen, setFilterOpen] = useState(false);

  const roomIds = useMemo(
    () => roomFilter ? getRoomFilterIds(rooms, roomFilter) : null,
    [roomFilter, rooms],
  );

  const activeFilterCount = [statusFilter, locationFilter, roomFilter, sortBy !== 'default' ? sortBy : undefined].filter(Boolean).length;

  const handleSectionChange = (val: EquipmentSection | 'all') => {
    setSection(val);
    setCategory('all');
  };

  const categories = CATEGORIES_BY_SECTION[section].filter((c) => {
    if (c.value === 'all') return true;
    return items.some((e) => e.category === c.value && (section === 'all' || e.section === section));
  });

  const filtered = useMemo(() => {
    if (!showControls) return items;
    const q = search.toLowerCase();
    let result = items.filter((eq) => {
      if (eq.parentId) return false;
      if (section !== 'all' && eq.section !== section) return false;
      if (category !== 'all' && eq.category !== category) return false;
      if (statusFilter && eq.currentStatus !== statusFilter) return false;
      if (locationFilter && eq.currentLocation !== locationFilter) return false;
      if (roomIds && (eq.roomId == null || !roomIds.has(eq.roomId))) return false;
      if (q && !eq.model.toLowerCase().includes(q) && !eq.subtitle.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === 'name_asc') result = [...result].sort((a, b) => a.model.localeCompare(b.model, 'ru'));
    if (sortBy === 'name_desc') result = [...result].sort((a, b) => b.model.localeCompare(a.model, 'ru'));
    if (sortBy === 'status') result = [...result].sort((a, b) => a.currentStatus.localeCompare(b.currentStatus, 'ru'));
    return result;
  }, [items, showControls, search, section, category, statusFilter, locationFilter, roomIds, sortBy]);

  const grouped = useMemo<Equipment[][]>(() => {
    if (showControls) return [];
    const map = new Map<string, Equipment[]>();
    for (const eq of filtered) {
      if (!map.has(eq.model)) map.set(eq.model, []);
      map.get(eq.model)!.push(eq);
    }
    return Array.from(map.values());
  }, [filtered, showControls]);

  useEffect(() => {
    setModalEquipment((prev) => prev ? (items.find((e) => e.id === prev.id) ?? prev) : null);
  }, [items]);

  useEffect(() => { setModalKey((k) => k + 1); }, [detailKey]);

  const handleCardClick = (eq: Equipment) => { setModalEquipment(eq); setModalKey((k) => k + 1); };

  const handleGroupClick = (group: Equipment[]) => {
    if (group.length === 1) { handleCardClick(group[0]); }
    else { setGroupDrawerModel(group[0].model); }
  };;

  const handleComponentClick = (eq: Equipment) => { setModalEquipment(eq); setModalKey((k) => k + 1); };

  const handleModalStatusUpdate = useCallback(async (
    status: EquipmentStatus,
    location: EquipmentLocation,
    responsible: string,
  ) => {
    if (!modalEquipment) return;
    try {
      await historyService.addEntry(modalEquipment.id, status, location, responsible);
      await onEquipmentChange();
    } catch {
      void message.error('Ошибка при обновлении статуса');
    }
  }, [modalEquipment, onEquipmentChange, message]);

  const handleModalEdit = () => {
    if (modalEquipment) { onEdit(modalEquipment); setModalEquipment(null); }
  };

  const handleResetFilters = () => {
    setStatusFilter(undefined);
    setLocationFilter(undefined);
    setRoomFilter(undefined);
    setSortBy('default');
  };

  const roomTreeData = useMemo(() => buildFilterOfficeTree(rooms), [rooms]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Mobile controls */}
      {showControls && (
        <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Search row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              size="small"
              style={{ flex: 1 }}
            />
            <Badge count={activeFilterCount} size="small" offset={[-4, 4]}>
              <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={() => setFilterOpen(true)}
                type={activeFilterCount > 0 ? 'primary' : 'default'}
              />
            </Badge>
            {canEdit && (
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd} />
            )}
          </div>

          {/* Section tabs */}
          <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {SECTION_TABS.map((tab) => (
              <span key={tab.value} style={chipStyle(section === tab.value)} onClick={() => handleSectionChange(tab.value)}>
                {tab.label}
              </span>
            ))}
          </div>

          {/* Category chips */}
          {categories.length > 2 && (
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {categories.map((c) => (
                <span key={c.value} style={chipStyle(category === c.value)} onClick={() => setCategory(c.value)}>
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '60px 0', fontSize: 14 }}>
            Ничего не найдено
          </div>
        ) : showControls ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {filtered.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                onClick={() => handleCardClick(eq)}
                onAddToCart={onAddToCart ? () => void onAddToCart(eq.id) : undefined}
                componentCount={allEquipment.filter((e) => e.parentId === eq.id).length}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {grouped.map((group) => (
              <ModelCard
                key={group[0].model}
                group={group}
                onClick={() => handleGroupClick(group)}
                onAddToCart={onAddToCart && group.length === 1 ? () => void onAddToCart(group[0].id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile filter drawer */}
      {showControls && (
        <Drawer
          title="Фильтры"
          placement="bottom"
          height="auto"
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          extra={
            activeFilterCount > 0 && (
              <Button size="small" type="link" onClick={handleResetFilters}>Сбросить</Button>
            )
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>Статус</div>
              <Select value={statusFilter} onChange={setStatusFilter} placeholder="Любой статус" allowClear style={{ width: '100%' }} options={STATUS_OPTIONS} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>Локация</div>
              <Select value={locationFilter} onChange={setLocationFilter} placeholder="Любая локация" allowClear style={{ width: '100%' }} options={LOCATION_OPTIONS} />
            </div>
            {rooms.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>Помещение</div>
                <TreeSelect
                  value={roomFilter}
                  onChange={setRoomFilter}
                  placeholder="Все помещения"
                  treeData={roomTreeData}
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                  style={{ width: '100%' }}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>Упорядочивание</div>
              <Select value={sortBy} onChange={setSortBy} style={{ width: '100%' }} options={SORT_OPTIONS} />
            </div>
          </div>
        </Drawer>
      )}

      {/* Model group drawer */}
      {groupDrawerModel !== null && (() => {
        const groupItems = filtered.filter((e) => e.model === groupDrawerModel);
        return (
          <Drawer
            title={<span>{groupDrawerModel} <Typography.Text type="secondary" style={{ fontSize: 13 }}>({groupItems.length} шт.)</Typography.Text></span>}
            placement="right"
            width={420}
            open
            onClose={() => setGroupDrawerModel(null)}
            styles={{ body: { padding: 0 } }}
          >
            <List
              dataSource={groupItems}
              renderItem={(eq) => (
                <List.Item
                  style={{ padding: '10px 16px', cursor: 'pointer' }}
                  onClick={() => { setGroupDrawerModel(null); handleCardClick(eq); }}
                  actions={[<RightOutlined key="open" style={{ color: '#bfbfbf' }} />]}
                >
                  <List.Item.Meta
                    title={<span style={{ fontSize: 13 }}>{eq.invNumber || eq.id}</span>}
                    description={
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                        <Tag color={STATUS_DOT_COLOR[eq.currentStatus]} style={{ margin: 0, fontSize: 11 }}>{eq.currentStatus}</Tag>
                        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{eq.currentLocation}</span>
                        {eq.serialNumber && <span style={{ fontSize: 11, color: '#bfbfbf' }}>s/n: {eq.serialNumber}</span>}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Drawer>
        );
      })()}

      {/* Detail modal */}
      <Modal
        open={!!modalEquipment}
        onCancel={() => setModalEquipment(null)}
        title={modalEquipment?.model}
        footer={null}
        width={820}
        styles={{ body: { padding: 0 } }}
        destroyOnClose
      >
        {modalEquipment && (
          <div style={{ maxHeight: 'calc(90vh - 108px)', overflowY: 'auto' }}>
            <EquipmentDetail
              key={`modal-${modalEquipment.id}-${modalKey}`}
              equipment={modalEquipment}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onEdit={handleModalEdit}
              onDelete={onDelete ? async () => { await onDelete(modalEquipment); setModalEquipment(null); } : undefined}
              onDuplicate={onDuplicate ? () => { onDuplicate(modalEquipment); setModalEquipment(null); } : undefined}
              project={getEquipmentProject(modalEquipment.id) ?? null}
              equipmentProjects={getEquipmentProjects(modalEquipment.id)}
              onProjectClick={(p) => { setModalEquipment(null); onProjectClick(p); }}
              onStatusUpdate={handleModalStatusUpdate}
              rooms={rooms}
              allEquipment={allEquipment}
              onComponentClick={handleComponentClick}
              onDetach={onDetach ? async () => { await onDetach(modalEquipment); } : undefined}
              onAssemblyStatusChange={onAssemblyStatusChange ? async (s) => { await onAssemblyStatusChange(modalEquipment, s); } : undefined}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
