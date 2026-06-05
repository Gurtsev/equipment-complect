import React from 'react';
import { Tag } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import type { Equipment } from '../../models/Equipment';


const S = { fill: '#e8e8e8', stroke: '#bfbfbf', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SN = { ...S, fill: 'none' };

const CATEGORY_SVG: Record<string, React.ReactNode> = {
  camera: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="10" y="22" width="60" height="38" rx="5" {...S} />
      <circle cx="40" cy="41" r="13" {...SN} />
      <circle cx="40" cy="41" r="7" {...SN} />
      <rect x="26" y="14" width="18" height="9" rx="3" {...S} />
      <circle cx="62" cy="29" r="3" {...S} />
    </svg>
  ),
  microphone: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="28" y="8" width="24" height="36" rx="12" {...S} />
      <path d="M20 38 Q20 58 40 58 Q60 58 60 38" {...SN} />
      <line x1="40" y1="58" x2="40" y2="70" {...SN} />
      <line x1="28" y1="70" x2="52" y2="70" {...SN} />
    </svg>
  ),
  light: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <circle cx="40" cy="38" r="14" {...S} />
      {[0,45,90,135,180,225,270,315].map((a) => {
        const r1 = 20, r2 = 28, rad = (a * Math.PI) / 180;
        return <line key={a} x1={40 + r1 * Math.cos(rad)} y1={38 + r1 * Math.sin(rad)} x2={40 + r2 * Math.cos(rad)} y2={38 + r2 * Math.sin(rad)} {...SN} />;
      })}
      <line x1="40" y1="62" x2="40" y2="70" {...SN} />
      <line x1="32" y1="70" x2="48" y2="70" {...SN} />
    </svg>
  ),
  computer: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="8" y="14" width="64" height="40" rx="3" {...S} />
      <rect x="13" y="19" width="54" height="30" rx="1" fill="#d4d4d4" stroke="#bfbfbf" strokeWidth={1.5} />
      <line x1="40" y1="54" x2="40" y2="64" {...SN} />
      <rect x="26" y="64" width="28" height="5" rx="2" {...S} />
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <path d="M18 44 Q18 14 40 14 Q62 14 62 44" {...SN} />
      <rect x="10" y="42" width="12" height="20" rx="6" {...S} />
      <rect x="58" y="42" width="12" height="20" rx="6" {...S} />
    </svg>
  ),
  accessory: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <polygon points="40,10 66,25 66,55 40,70 14,55 14,25" {...S} />
      <polygon points="40,22 54,30 54,50 40,58 26,50 26,30" fill="none" stroke="#bfbfbf" strokeWidth={2} />
    </svg>
  ),
  optics: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <circle cx="28" cy="40" r="20" {...S} />
      <circle cx="52" cy="40" r="20" {...S} />
      <circle cx="28" cy="40" r="10" {...SN} />
      <circle cx="52" cy="40" r="10" {...SN} />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="22" y="8" width="36" height="64" rx="7" {...S} />
      <rect x="28" y="14" width="24" height="38" rx="2" fill="#d4d4d4" stroke="#bfbfbf" strokeWidth={1.5} />
      <circle cx="40" cy="64" r="4" {...SN} />
    </svg>
  ),
  furniture: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="6" y="28" width="68" height="10" rx="3" {...S} />
      <rect x="14" y="38" width="8" height="26" rx="3" {...S} />
      <rect x="58" y="38" width="8" height="26" rx="3" {...S} />
      <rect x="14" y="16" width="52" height="12" rx="3" {...S} />
    </svg>
  ),
  prop: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <polygon points="40,8 48,32 72,32 53,48 60,72 40,57 20,72 27,48 8,32 32,32" {...S} />
    </svg>
  ),
  tool: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <path d="M56 8 C66 8 72 14 72 22 C72 26 70 30 67 32 L44 56 C46 62 44 70 38 74 C30 78 22 72 20 64 C18 56 24 48 32 48 C34 48 36 48.5 38 50 L60 26 C58 22 58 14 62 10 Z" {...S} />
      <circle cx="30" cy="62" r="5" fill="#d4d4d4" stroke="#bfbfbf" strokeWidth={2} />
    </svg>
  ),
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
  onAddToCart?: () => void;
}

export function EquipmentCard({ equipment, onClick, onAddToCart }: Props) {

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
            {CATEGORY_SVG[equipment.category] ?? (
              <svg viewBox="0 0 80 80" width="64" height="64">
                <rect x="14" y="14" width="52" height="52" rx="8" fill="#e8e8e8" stroke="#bfbfbf" strokeWidth={2.5} />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 10px', flex: 1, minWidth: 0 }}>
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

      {onAddToCart && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart(); }}
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#52c41a',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 13,
            boxShadow: '0 2px 6px rgba(82,196,26,0.4)',
            zIndex: 2,
          }}
          title="В корзину"
        >
          <ShoppingCartOutlined />
        </button>
      )}
    </div>
  );
}
