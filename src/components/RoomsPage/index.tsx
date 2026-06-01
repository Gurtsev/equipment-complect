import { useState } from 'react';
import {
  Typography,
  Tree,
  Button,
  Input,
  Space,
  Table,
  Tag,
  Flex,
  Empty,
  App,
} from 'antd';
import {
  PrinterOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { QRCodeSVG } from 'qrcode.react';
import {
  buildRoomTree,
  getRoomPath,
  OFFICE_LABEL,
  roomService,
} from '../../services/roomService';
import type { Room, RoomTreeNode } from '../../services/roomService';
import type { Equipment, EquipmentStatus } from '../../models/Equipment';

const { Text, Title } = Typography;

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'green',
  'На Складе': 'blue',
  'В Ремонте': 'orange',
  'Списано': 'red',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
  'Выдан': 'volcano',
};

function toTreeNodes(nodes: RoomTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    title: n.name,
    key: n.id,
    children: n.children.length > 0 ? toTreeNodes(n.children) : undefined,
  }));
}

function buildPageTree(rooms: Room[]): DataNode[] {
  const offices = ['A', 'B', 'C'] as const;
  return offices
    .filter((o) => rooms.some((r) => r.office === o))
    .map((office) => ({
      title: <Text strong>{OFFICE_LABEL[office]}</Text>,
      key: `office-${office}`,
      selectable: false,
      children: toTreeNodes(buildRoomTree(rooms.filter((r) => r.office === office))),
    }));
}

function getRoomSubtreeIds(rooms: Room[], roomId: string): Set<string> {
  const result = new Set<string>();
  const queue = [roomId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    rooms.filter((r) => r.parentId === id).forEach((r) => queue.push(r.id));
  }
  return result;
}

interface Props {
  rooms: Room[];
  allEquipment: Equipment[];
  canEdit: boolean;
  selectedRoom: Room | null;
  onRoomSelect: (room: Room | null) => void;
  onRoomsChanged: () => Promise<void>;
}

export function RoomsPage({
  rooms,
  allEquipment,
  canEdit,
  selectedRoom,
  onRoomSelect,
  onRoomsChanged,
}: Props) {
  const { message } = App.useApp();
  const [editingResponsible, setEditingResponsible] = useState(false);
  const [responsibleValue, setResponsibleValue] = useState('');
  const [saving, setSaving] = useState(false);

  const treeData = buildPageTree(rooms);
  const defaultExpandedKeys = ['office-A', 'office-B', 'office-C'];

  const qrUrl = selectedRoom
    ? `${window.location.origin}/?room=${selectedRoom.code}`
    : '';

  const roomEquipment = selectedRoom
    ? (() => {
        const ids = getRoomSubtreeIds(rooms, selectedRoom.id);
        return allEquipment.filter((e) => e.roomId != null && ids.has(e.roomId));
      })()
    : [];

  const handleTreeSelect = (keys: React.Key[]) => {
    const key = keys[0] as string;
    if (!key || key.startsWith('office-')) {
      onRoomSelect(null);
      return;
    }
    onRoomSelect(rooms.find((r) => r.id === key) ?? null);
  };

  const handleEditResponsible = () => {
    setResponsibleValue(selectedRoom?.responsible ?? '');
    setEditingResponsible(true);
  };

  const handleSaveResponsible = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      await roomService.updateResponsible(selectedRoom.id, responsibleValue.trim());
      await onRoomsChanged();
      setEditingResponsible(false);
      void message.success('Сохранено');
    } catch {
      void message.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Инв. номер',
      dataIndex: 'invNumber',
      key: 'inv',
      width: 130,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Модель',
      dataIndex: 'model',
      key: 'model',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Статус',
      key: 'status',
      width: 120,
      render: (_: unknown, eq: Equipment) => (
        <Tag color={STATUS_COLOR[eq.currentStatus]} style={{ fontSize: 11 }}>
          {eq.currentStatus}
        </Tag>
      ),
    },
    {
      title: 'Ответственный',
      dataIndex: 'responsible',
      key: 'responsible',
      width: 150,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
  ];

  return (
    <Flex style={{ height: '100%' }}>
      {/* Левое дерево */}
      <div
        style={{
          width: 260,
          borderRight: '1px solid #f0f0f0',
          overflow: 'auto',
          padding: '12px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '4px 16px 10px' }}>
          <Text strong style={{ fontSize: 15 }}>
            Помещения
          </Text>
        </div>
        <Tree
          treeData={treeData}
          defaultExpandedKeys={defaultExpandedKeys}
          selectedKeys={selectedRoom ? [selectedRoom.id] : []}
          onSelect={handleTreeSelect}
          blockNode
          style={{ fontSize: 13, paddingRight: 8 }}
        />
      </div>

      {/* Правая панель */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {!selectedRoom ? (
          <Empty description="Выберите помещение" style={{ marginTop: 80 }} />
        ) : (
          <>
            {/* Только для печати */}
            <div className="print-only" style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                {selectedRoom.name}
              </div>
              <div style={{ color: '#595959', marginBottom: 20 }}>
                {getRoomPath(rooms, selectedRoom.id)}
              </div>
              <QRCodeSVG value={qrUrl} size={200} />
              {selectedRoom.responsible && (
                <div style={{ marginTop: 16 }}>
                  Ответственный: {selectedRoom.responsible}
                </div>
              )}
            </div>

            {/* Обычный вид */}
            <div className="no-print">
              <Flex justify="space-between" align="flex-start" style={{ marginBottom: 24 }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>
                    {selectedRoom.name}
                  </Title>
                  <Text type="secondary">{getRoomPath(rooms, selectedRoom.id)}</Text>
                </div>
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  Печать QR
                </Button>
              </Flex>

              <Flex gap={32} align="flex-start" style={{ marginBottom: 32 }}>
                {/* QR-код */}
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <QRCodeSVG value={qrUrl} size={160} />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: '#8c8c8c',
                      maxWidth: 160,
                      wordBreak: 'break-all',
                    }}
                  >
                    {qrUrl}
                  </div>
                </div>

                {/* Реквизиты */}
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Ответственный
                  </Text>
                  {editingResponsible ? (
                    <Space>
                      <Input
                        size="small"
                        value={responsibleValue}
                        onChange={(e) => setResponsibleValue(e.target.value)}
                        style={{ width: 220 }}
                        onPressEnter={() => void handleSaveResponsible()}
                        autoFocus
                      />
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckOutlined />}
                        loading={saving}
                        onClick={() => void handleSaveResponsible()}
                      />
                      <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => setEditingResponsible(false)}
                      />
                    </Space>
                  ) : (
                    <Space>
                      <Text>{selectedRoom.responsible || '—'}</Text>
                      {canEdit && (
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={handleEditResponsible}
                        />
                      )}
                    </Space>
                  )}
                </div>
              </Flex>

              {/* Список МЦ */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 10 }}>
                  Материальные ценности ({roomEquipment.length})
                </Text>
                {roomEquipment.length === 0 ? (
                  <Text type="secondary">В этом помещении ничего не числится</Text>
                ) : (
                  <Table
                    dataSource={roomEquipment}
                    columns={columns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ y: 400 }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Flex>
  );
}
