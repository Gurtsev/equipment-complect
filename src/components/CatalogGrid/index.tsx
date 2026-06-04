import { useState, useCallback, useEffect } from 'react';
import { Button, Modal, App } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { EquipmentCard } from '../EquipmentCard';
import { EquipmentDetail } from '../EquipmentDetail';
import { historyService } from '../../services/historyService';
import type { Equipment, EquipmentStatus, EquipmentLocation } from '../../models/Equipment';
import type { Project } from '../../models/Project';
import type { Room } from '../../services/roomService';


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
          <span style={{ flex: 1, fontSize: 13, color: '#8c8c8c' }}>
            {items.length} ед.
          </span>
          <Button icon={<UnorderedListOutlined />} onClick={onSwitchToList} title="Список" />
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              Добавить
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '60px 0', fontSize: 14 }}>
            Ничего не найдено
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {items.map((eq) => (
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
