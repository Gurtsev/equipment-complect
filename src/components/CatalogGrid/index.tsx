import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Button, Modal, App } from 'antd';
import { SearchOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { EquipmentCard } from '../EquipmentCard';
import { EquipmentDetail } from '../EquipmentDetail';
import { historyService } from '../../services/historyService';
import type { Equipment, EquipmentStatus, EquipmentLocation, EquipmentSection, EquipmentCategory } from '../../models/Equipment';
import type { Project } from '../../models/Project';
import type { Room } from '../../services/roomService';

const SECTION_TABS: Array<{ label: string; value: EquipmentSection | 'all' }> = [
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
    { label: 'Все', value: 'all' },
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
  furniture: [{ label: 'Все', value: 'all' }, { label: 'Мебель', value: 'furniture' }],
  prop: [{ label: 'Все', value: 'all' }, { label: 'Реквизит', value: 'prop' }, { label: 'Аксессуары', value: 'accessory' }],
};

interface Props {
  items: Equipment[];
  canEditEquipment: (dept: string) => boolean;
  canEdit: boolean;
  onAdd: () => void;
  onSwitchToList: () => void;
  onEdit: (eq: Equipment) => void;
  rooms: Room[];
  projects: Project[];
  getEquipmentProject: (id: string) => Project | undefined;
  getEquipmentProjects: (id: string) => Project[];
  onProjectClick: (project: Project) => void;
  onEquipmentChange: () => Promise<void>;
  detailKey: number;
}

export function CatalogGrid({
  items,
  canEditEquipment,
  canEdit,
  onAdd,
  onSwitchToList,
  onEdit,
  rooms,
  getEquipmentProject,
  getEquipmentProjects,
  onProjectClick,
  onEquipmentChange,
  detailKey,
}: Props) {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<EquipmentSection | 'all'>('all');
  const [category, setCategory] = useState<EquipmentCategory | 'all'>('all');
  const [modalEquipment, setModalEquipment] = useState<Equipment | null>(null);
  const [modalKey, setModalKey] = useState(0);

  // Сбрасываем категорию при смене секции
  const handleSectionChange = (val: EquipmentSection | 'all') => {
    setSection(val);
    setCategory('all');
  };

  const categories = CATEGORIES_BY_SECTION[section].filter((c) => {
    if (c.value === 'all') return true;
    return items.some((e) => e.category === c.value && (section === 'all' || e.section === section));
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((eq) => {
      if (section !== 'all' && eq.section !== section) return false;
      if (category !== 'all' && eq.category !== category) return false;
      if (q && !eq.model.toLowerCase().includes(q) && !eq.subtitle.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, section, category, search]);

  useEffect(() => {
    setModalEquipment((prev) => {
      if (!prev) return null;
      return items.find((e) => e.id === prev.id) ?? prev;
    });
  }, [items]);

  useEffect(() => {
    setModalKey((k) => k + 1);
  }, [detailKey]);

  const handleCardClick = (eq: Equipment) => {
    setModalEquipment(eq);
    setModalKey((k) => k + 1);
  };

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
    if (modalEquipment) {
      onEdit(modalEquipment);
      setModalEquipment(null);
    }
  };

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {/* Top row: search + buttons */}
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
          <Button size="small" icon={<UnorderedListOutlined />} onClick={onSwitchToList} title="Список" />
          {canEdit && (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={onAdd} />
          )}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SECTION_TABS.map((tab) => (
            <span key={tab.value} style={chipStyle(section === tab.value)} onClick={() => handleSectionChange(tab.value)}>
              {tab.label}
            </span>
          ))}
        </div>

        {/* Category chips — только если категорий больше 1 */}
        {categories.length > 2 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {categories.map((c) => (
              <span key={c.value} style={chipStyle(category === c.value)} onClick={() => setCategory(c.value)}>
                {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '60px 0', fontSize: 14 }}>
            Ничего не найдено
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 10,
          }}>
            {filtered.map((eq) => (
              <EquipmentCard key={eq.id} equipment={eq} onClick={() => handleCardClick(eq)} />
            ))}
          </div>
        )}
      </div>

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
              canEdit={canEditEquipment(modalEquipment.department)}
              onEdit={handleModalEdit}
              project={getEquipmentProject(modalEquipment.id) ?? null}
              equipmentProjects={getEquipmentProjects(modalEquipment.id)}
              onProjectClick={(p) => { setModalEquipment(null); onProjectClick(p); }}
              onStatusUpdate={handleModalStatusUpdate}
              rooms={rooms}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
