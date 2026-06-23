import React from 'react';
import { Tag } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import type { Equipment } from '../../models/Equipment';


const S = { fill: '#e8e8e8', stroke: '#bfbfbf', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SN = { ...S, fill: 'none' };

export const CATEGORY_SVG: Record<string, React.ReactNode> = {
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
  laptop: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="14" y="10" width="52" height="36" rx="3" {...S} />
      <rect x="19" y="15" width="42" height="26" rx="1" fill="#d4d4d4" stroke="#bfbfbf" strokeWidth={1.5} />
      <path d="M8 56 L72 56 L66 66 L14 66 Z" {...S} />
    </svg>
  ),
  tv: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="8" y="12" width="64" height="42" rx="3" {...S} />
      <rect x="13" y="17" width="54" height="32" rx="1" fill="#d4d4d4" stroke="#bfbfbf" strokeWidth={1.5} />
      <line x1="40" y1="54" x2="40" y2="68" {...SN} />
      <line x1="26" y1="70" x2="54" y2="70" {...SN} />
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
  mount: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <rect x="8" y="34" width="20" height="12" rx="3" {...S} />
      <rect x="52" y="34" width="20" height="12" rx="3" {...S} />
      <line x1="28" y1="40" x2="52" y2="40" {...SN} />
      <circle cx="40" cy="40" r="5" {...S} />
      <line x1="40" y1="35" x2="40" y2="18" {...SN} />
      <rect x="30" y="12" width="20" height="8" rx="3" {...S} />
    </svg>
  ),
  stand: (
    <svg viewBox="0 0 80 80" width="64" height="64">
      <line x1="40" y1="8" x2="40" y2="64" {...SN} />
      <line x1="40" y1="30" x2="16" y2="68" {...SN} />
      <line x1="40" y1="30" x2="64" y2="68" {...SN} />
      <line x1="12" y1="68" x2="20" y2="68" {...SN} />
      <line x1="60" y1="68" x2="68" y2="68" {...SN} />
      <line x1="36" y1="68" x2="44" y2="68" {...SN} />
      <rect x="34" y="5" width="12" height="7" rx="2" {...S} />
    </svg>
  ),
};

export const CATEGORY_LABEL: Record<string, string> = {
  camera: 'Камера',
  microphone: 'Микрофон',
  light: 'Свет',
  computer: 'Компьютер',
  laptop: 'Ноутбук',
  tv: 'Телевизор',
  audio: 'Аудио',
  accessory: 'Аксессуар',
  optics: 'Оптика',
  phone: 'Телефон',
  stand: 'Стойка/Штатив',
  mount: 'Крепление',
  furniture: 'Мебель',
  prop: 'Реквизит',
  tool: 'Инструмент',
};

interface Props {
  equipment: Equipment;
  onClick: () => void;
  onAddToCart?: () => void;
  componentCount?: number;
}

export function EquipmentCard({ equipment, onClick, onAddToCart, componentCount }: Props) {

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
      {!!componentCount && (
        <div style={{
          position: 'absolute', top: 6, left: 6, zIndex: 2,
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600,
        }}>
          🔗 {componentCount}
        </div>
      )}

      {/* Image / placeholder */}
      <div style={{ position: 'relative', paddingTop: '66%', background: '#f5f5f5', flexShrink: 0 }}>
        {equipment.image ? (
          <img
            src={equipment.image}
            alt={equipment.model}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
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
