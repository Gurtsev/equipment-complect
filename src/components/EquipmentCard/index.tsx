import { Tag } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { Equipment } from '../../models/Equipment';

const STATUS_COLOR: Record<string, string> = {
  'В Работе': '#1677ff',
  'На Складе': '#52c41a',
  'В Ремонте': '#fa8c16',
  'Списано': '#bfbfbf',
  'В Пути': '#722ed1',
  'Забронировано': '#faad14',
  'Выдан': '#13c2c2',
};

const CATEGORY_LABEL: Record<string, string> = {
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

interface Props {
  equipment: Equipment;
  onClick: () => void;
}

export function EquipmentCard({ equipment, onClick }: Props) {
  const status = equipment.currentStatus;
  const statusColor = STATUS_COLOR[status] ?? '#bfbfbf';

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
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        e.currentTarget.style.borderColor = '#d9d9d9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#f0f0f0';
      }}
    >
      {/* Image / placeholder */}
      <div style={{ position: 'relative', paddingTop: '66%', background: '#f5f5f5', flexShrink: 0 }}>
        {equipment.image ? (
          <img
            src={equipment.image}
            alt={equipment.model}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <InboxOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />
          </div>
        )}
        {/* Status badge */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: statusColor,
          color: '#fff',
          borderRadius: 4,
          padding: '2px 7px',
          fontSize: 11,
          fontWeight: 500,
          lineHeight: '18px',
        }}>
          {status}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 13,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 2,
        }}>
          {equipment.model}
        </div>
        {equipment.subtitle && (
          <div style={{
            fontSize: 12, color: '#8c8c8c',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 6,
          }}>
            {equipment.subtitle}
          </div>
        )}
        <Tag style={{ fontSize: 11, margin: 0 }}>
          {CATEGORY_LABEL[equipment.category] ?? equipment.category}
        </Tag>
      </div>
    </div>
  );
}
