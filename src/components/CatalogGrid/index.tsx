import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input, Button, Modal, App } from 'antd';
import { SearchOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { EquipmentCard } from '../EquipmentCard';
import { EquipmentDetail } from '../EquipmentDetail';
import { historyService } from '../../services/historyService';
import type { Equipment, EquipmentStatus, EquipmentLocation, EquipmentSection } from '../../models/Equipment';
import type { Project } from '../../models/Project';
import type { Room } from '../../services/roomService';

const SECTION_TABS: Array<{ label: string; value: EquipmentSection | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Техника', value: 'tech' },
  { label: 'Мебель', value: 'furniture' },
  { label: 'Реквизит', value: 'prop' },
];

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
  const [modalEquipment, setModalEquipment] = useState<Equipment | null>(null);
  const [modalKey, setModalKey] = useState(0);

  // Sync modal equipment when items reload
  useEffect(() => {
    setModalEquipment((prev) => {
      if (!prev) return null;
      return items.find((e) => e.id === prev.id) ?? prev;
    });
  }, [items]);

  // Also force-remount EquipmentDetail inside modal when detailKey changes
  useEffect(() => {
    setModalKey((k) => k + 1);
  }, [detailKey]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((eq) => {
      if (section !== 'all' && eq.section !== section) return false;
      if (q && !eq.model.toLowerCase().includes(q) && !eq.subtitle.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, section, search]);

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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ flex: 1 }}
          />
          <Button
            icon={<UnorderedListOutlined />}
            onClick={onSwitchToList}
            title="Список"
          />
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              Добавить
            </Button>
          )}
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {SECTION_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? items.length
              : items.filter((e) => e.section === tab.value).length;
            const active = section === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setSection(tab.value)}
                style={{
                  padding: '4px 14px',
                  borderRadius: 16,
                  border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
                  background: active ? '#e6f4ff' : '#fff',
                  color: active ? '#1677ff' : '#595959',
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
                <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '60px 0', fontSize: 14 }}>
            Ничего не найдено
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
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
