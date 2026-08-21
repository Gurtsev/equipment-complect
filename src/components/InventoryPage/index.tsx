import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  List,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  CheckCircleOutlined,
  PlusOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import type { Equipment } from '../../models/Equipment';
import type { Room } from '../../services/roomService';
import { getRoomPath } from '../../services/roomService';
import { supabase } from '../../services/supabase';
import {
  inventorySessionService,
  normalizeInventoryCode,
  type InventoryItemResult,
  type InventorySession,
  type InventorySessionItem,
} from '../../services/inventorySessionService';

const { Text, Title } = Typography;

const RESULT_META: Record<InventoryItemResult, { label: string; color: string }> = {
  pending: { label: 'Не проверено', color: 'default' },
  found: { label: 'На месте', color: 'success' },
  misplaced: { label: 'Не в том помещении', color: 'warning' },
  accounted_elsewhere: { label: 'Учтено вне помещения', color: 'processing' },
  missing: { label: 'Не найдено', color: 'error' },
  unexpected: { label: 'Не ожидалось здесь', color: 'magenta' },
};

const SESSION_META: Record<InventorySession['status'], { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'default' },
  in_progress: { label: 'Идёт проверка', color: 'processing' },
  review: { label: 'Разбор', color: 'warning' },
  completed: { label: 'Завершена', color: 'success' },
  cancelled: { label: 'Отменена', color: 'default' },
};

interface Props {
  rooms: Room[];
  equipment: Equipment[];
  canEdit: boolean;
}

function sessionDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function InventoryPage({ rooms, equipment, canEdit }: Props) {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const mobile = !screens.md;
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [items, setItems] = useState<InventorySessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');
  const [actualRoomId, setActualRoomId] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<InventoryItemResult | 'all'>('all');
  const [form] = Form.useForm();

  const loadSessions = useCallback(async () => {
    const next = await inventorySessionService.getAll();
    setSessions(next);
    setSelectedId((current) => current && next.some((s) => s.id === current) ? current : (next[0]?.id ?? null));
  }, []);

  const loadItems = useCallback(async (sessionId: string) => {
    setItemsLoading(true);
    try {
      setItems(await inventorySessionService.getItems(sessionId));
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions().catch(() => message.error('Не удалось загрузить инвентаризации')).finally(() => setLoading(false));
  }, [loadSessions, message]);

  useEffect(() => {
    if (!selectedId) {
      setItems([]);
      return;
    }
    void loadItems(selectedId).catch(() => message.error('Не удалось загрузить результаты'));
  }, [selectedId, loadItems, message]);

  useEffect(() => {
    const channel = supabase
      .channel('inventory-session-changes')
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'inventory_sessions' }, () => void loadSessions())
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'inventory_session_items' }, (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown>;
        if (selectedId && row.session_id === selectedId) void loadItems(selectedId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadItems, loadSessions, selectedId]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  const roomOptions = rooms.map((room) => ({ label: getRoomPath(rooms, room.id), value: room.id }));
  const equipmentMap = useMemo(() => new Map(equipment.map((item) => [item.id, item])), [equipment]);
  const counts = useMemo(() => items.reduce<Record<InventoryItemResult, number>>((acc, item) => {
    acc[item.result] += 1;
    return acc;
  }, { pending: 0, found: 0, misplaced: 0, accounted_elsewhere: 0, missing: 0, unexpected: 0 }), [items]);
  const checked = items.length - counts.pending;
  const percent = items.length === 0 ? 0 : Math.round((checked / items.length) * 100);
  const filteredItems = resultFilter === 'all' ? items : items.filter((item) => item.result === resultFilter);

  const handleCreate = async (values: { name: string; roomId: string; notes?: string }) => {
    setCreating(true);
    try {
      const id = await inventorySessionService.create(values.name, values.roomId, values.notes);
      await loadSessions();
      setSelectedId(id);
      setActualRoomId(values.roomId);
      setCreateOpen(false);
      form.resetFields();
      void message.success('Инвентаризация начата');
    } catch {
      void message.error('Не удалось начать инвентаризацию');
    } finally {
      setCreating(false);
    }
  };

  const handleScan = async () => {
    if (!selected || !actualRoomId) {
      void message.warning('Укажите фактическое помещение');
      return;
    }
    const normalized = normalizeInventoryCode(code);
    if (!normalized) return;
    setScanning(true);
    try {
      const result = await inventorySessionService.scan(selected.id, normalized, actualRoomId);
      setCode('');
      await loadItems(selected.id);
      if (result.result === 'unknown') void message.error('Код не найден в каталоге');
      else if (result.result === 'duplicate') void message.warning('Эта единица уже отсканирована');
      else if (result.result === 'found') void message.success('Найдено на месте');
      else void message.warning(RESULT_META[result.result as InventoryItemResult]?.label ?? 'Зафиксировано');
    } catch {
      void message.error('Не удалось сохранить сканирование');
    } finally {
      setScanning(false);
      window.setTimeout(() => document.getElementById('inventory-scan-input')?.focus(), 0);
    }
  };

  const handleFinish = async () => {
    if (!selected) return;
    try {
      const missing = await inventorySessionService.finish(selected.id);
      await Promise.all([loadSessions(), loadItems(selected.id)]);
      void message.success(missing > 0 ? `Завершено. Не найдено: ${missing}` : 'Инвентаризация завершена без пропусков');
    } catch {
      void message.error('Не удалось завершить инвентаризацию');
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    try {
      await inventorySessionService.cancel(selected.id);
      await loadSessions();
      void message.success('Инвентаризация отменена');
    } catch {
      void message.error('Не удалось отменить инвентаризацию');
    }
  };

  const columns: TableColumnsType<InventorySessionItem> = [
    {
      title: 'Оборудование', key: 'equipment',
      render: (_: unknown, row: InventorySessionItem) => {
        const item = equipmentMap.get(row.equipmentId);
        return <div><Text strong>{item?.model ?? row.equipmentId}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{item?.invNumber || row.equipmentId}</Text></div>;
      },
    },
    {
      title: 'Результат', dataIndex: 'result', key: 'result', width: 190,
      render: (result: InventoryItemResult) => <Tag color={RESULT_META[result].color}>{RESULT_META[result].label}</Tag>,
    },
    {
      title: 'Ожидалось', dataIndex: 'expectedRoomId', key: 'expectedRoom',
      responsive: ['lg'],
      render: (roomId: string | null) => roomId ? getRoomPath(rooms, roomId) : '—',
    },
    {
      title: 'Найдено', dataIndex: 'actualRoomId', key: 'actualRoom',
      responsive: ['lg'],
      render: (roomId: string | null) => roomId ? getRoomPath(rooms, roomId) : '—',
    },
  ];

  const sessionList = (
    <div style={{ width: mobile ? '100%' : 310, flexShrink: 0, borderRight: mobile ? 0 : '1px solid #e8eeea', overflow: 'auto', padding: 16 }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>Инвентаризации</Title>
        {canEdit && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Начать</Button>}
      </Flex>
      <List
        loading={loading}
        dataSource={sessions}
        locale={{ emptyText: 'Инвентаризаций ещё нет' }}
        renderItem={(session) => (
          <List.Item
            onClick={() => setSelectedId(session.id)}
            style={{ cursor: 'pointer', padding: '12px', borderRadius: 10, marginBottom: 6, background: selectedId === session.id ? '#edf8f1' : undefined }}
          >
            <div style={{ minWidth: 0 }}>
              <Text strong ellipsis style={{ display: 'block' }}>{session.name}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{sessionDate(session.createdAt)}</Text><br />
              <Tag color={SESSION_META[session.status].color} style={{ marginTop: 6 }}>{SESSION_META[session.status].label}</Tag>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  const detail = !selected ? (
    <Flex flex={1} align="center" justify="center"><Empty description="Выберите или начните инвентаризацию" /></Flex>
  ) : (
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: mobile ? 14 : 24 }}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
        <div>
          <Space wrap><Title level={4} style={{ margin: 0 }}>{selected.name}</Title><Tag color={SESSION_META[selected.status].color}>{SESSION_META[selected.status].label}</Tag></Space>
          <Text type="secondary">{getRoomPath(rooms, selected.roomId)} · с вложенными помещениями</Text>
        </div>
        {canEdit && selected.status === 'in_progress' && <Space>
          <Popconfirm title="Отменить инвентаризацию?" onConfirm={() => void handleCancel()}><Button danger>Отменить</Button></Popconfirm>
          <Popconfirm title={`Завершить проверку? Непроверенных позиций: ${counts.pending}`} onConfirm={() => void handleFinish()}><Button type="primary" icon={<CheckCircleOutlined />}>Завершить</Button></Popconfirm>
        </Space>}
      </Flex>

      <Card size="small" style={{ marginTop: 18 }}>
        <Flex gap={24} wrap="wrap" align="center">
          <Progress type="circle" size={72} percent={percent} />
          <Statistic title="Всего в снимке" value={items.length} />
          <Statistic title="На месте" value={counts.found} valueStyle={{ color: '#017038' }} />
          <Statistic title="Расхождения" value={counts.misplaced + counts.missing + counts.unexpected} valueStyle={{ color: '#cf1322' }} />
          <Statistic title="Учтено вне помещения" value={counts.accounted_elsewhere} />
        </Flex>
      </Card>

      {canEdit && selected.status === 'in_progress' && (
        <Card size="small" title={<Space><ScanOutlined />Сканирование</Space>} style={{ marginTop: 16 }}>
          <Flex gap={10} wrap="wrap">
            <Select showSearch optionFilterProp="label" placeholder="Где сканируем" value={actualRoomId} onChange={setActualRoomId} options={roomOptions} style={{ minWidth: mobile ? '100%' : 330 }} />
            <Input
              id="inventory-scan-input"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onPressEnter={() => void handleScan()}
              placeholder="ID, инвентарный номер или QR-ссылка"
              prefix={<ScanOutlined />}
              style={{ flex: 1, minWidth: 240 }}
            />
            <Button type="primary" loading={scanning} disabled={!code.trim() || !actualRoomId} onClick={() => void handleScan()}>Зафиксировать</Button>
          </Flex>
        </Card>
      )}

      <Flex justify="space-between" align="center" style={{ marginTop: 18, marginBottom: 10 }} gap={12} wrap="wrap">
        <Space><Text strong>Результаты</Text><Badge count={filteredItems.length} showZero color="#017038" /></Space>
        <Select
          value={resultFilter}
          onChange={setResultFilter}
          style={{ width: 220 }}
          options={[{ value: 'all', label: 'Все результаты' }, ...Object.entries(RESULT_META).map(([value, meta]) => ({ value, label: meta.label }))]}
        />
      </Flex>
      <Table rowKey="id" loading={itemsLoading} dataSource={filteredItems} columns={columns} size="small" pagination={{ pageSize: 25, hideOnSinglePage: true }} />
    </div>
  );

  return (
    <Flex vertical={mobile} style={{ height: '100%', background: '#fff' }}>
      {sessionList}
      {detail}
      <Modal title="Новая инвентаризация" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => void handleCreate(values)}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}><Input placeholder="Например, Склад — август 2026" /></Form.Item>
          <Form.Item name="roomId" label="Помещение" rules={[{ required: true, message: 'Выберите помещение' }]}><Select showSearch optionFilterProp="label" options={roomOptions} placeholder="Помещение и все вложенные комнаты" /></Form.Item>
          <Form.Item name="notes" label="Комментарий"><Input.TextArea rows={3} /></Form.Item>
          <Flex justify="flex-end" gap={8}><Button onClick={() => setCreateOpen(false)}>Отмена</Button><Button type="primary" htmlType="submit" loading={creating} icon={<PlusOutlined />}>Начать</Button></Flex>
        </Form>
      </Modal>
    </Flex>
  );
}
