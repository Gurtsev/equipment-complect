import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Button, Modal, App, Drawer, Select, Badge, TreeSelect } from 'antd';
import { SearchOutlined, PlusOutlined, FilterOutlined } from '@ant-design/icons';
import { EquipmentCard } from '../EquipmentCard';
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
    if (!showControls) return items.filter((eq) => !eq.parentId);
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

  useEffect(() => {
    setModalEquipment((prev) => prev ? (items.find((e) => e.id === prev.id) ?? prev) : null);
  }, [items]);

  useEffect(() => { setModalKey((k) => k + 1); }, [detailKey]);

  const handleCardClick = (eq: Equipment) => { setModalEquipment(eq); setModalKey((k) => k + 1); };

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
        ) : (
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
