import { useState, useEffect } from 'react';
import {
  Table, Tag, Button, Drawer, Modal, Form, Input, InputNumber, Select,
  Typography, Space, Tooltip, App,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ArrowUpOutlined, ArrowDownOutlined, CloseOutlined,
} from '@ant-design/icons';
import {
  consumablesService, Consumable, ConsumableCategory, ConsumableTransaction,
} from '../../services/consumablesService';

const { Text } = Typography;

const CATEGORY_LABEL: Record<ConsumableCategory, string> = {
  hygiene: 'Гигиена',
  drinks: 'Напитки',
  stationery: 'Канцелярия',
  cleaning: 'Уборка',
  other: 'Прочее',
};

const CATEGORY_COLOR: Record<ConsumableCategory, string> = {
  hygiene: 'cyan',
  drinks: 'blue',
  stationery: 'orange',
  cleaning: 'green',
  other: 'default',
};

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABEL) as ConsumableCategory[]).map((v) => ({
  value: v, label: CATEGORY_LABEL[v],
}));

const UNIT_OPTIONS = ['шт', 'рул', 'л', 'кг', 'упак', 'пач', 'бут'].map((u) => ({ value: u, label: u }));

const TX_LABEL: Record<string, string> = { in: 'Приход', out: 'Расход', writeoff: 'Списание' };
const TX_COLOR: Record<string, string> = { in: 'green', out: 'orange', writeoff: 'red' };

function stockLevel(qty: number, min: number): 'ok' | 'low' | 'critical' {
  if (min <= 0) return 'ok';
  if (qty < min) return 'critical';
  if (qty < min * 2) return 'low';
  return 'ok';
}

const STOCK_COLOR = { ok: '#52c41a', low: '#faad14', critical: '#ff4d4f' };

interface ItemFormValues {
  name: string;
  category: ConsumableCategory;
  unit: string;
  quantity: number;
  minThreshold: number;
  notes?: string;
}

interface Props {
  consumables: Consumable[];
  canEdit: boolean;
  onChanged: () => void;
}

export function ConsumablesPage({ consumables, canEdit, onChanged }: Props) {
  const { message, modal } = App.useApp();
  const [catFilter, setCatFilter] = useState<ConsumableCategory | 'all'>('all');

  const [selected, setSelected] = useState<Consumable | null>(null);
  const [transactions, setTransactions] = useState<ConsumableTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [txType, setTxType] = useState<'in' | 'out' | 'writeoff' | null>(null);
  const [txForm] = Form.useForm();
  const [txSubmitting, setTxSubmitting] = useState(false);

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Consumable | null>(null);
  const [itemForm] = Form.useForm<ItemFormValues>();
  const [itemFormLoading, setItemFormLoading] = useState(false);

  useEffect(() => {
    if (!selected) return;
    const updated = consumables.find((c) => c.id === selected.id);
    if (updated) setSelected(updated);
  }, [consumables]);

  const loadTransactions = async (id: string) => {
    setTxLoading(true);
    try {
      setTransactions(await consumablesService.getTransactions(id));
    } catch {
      void message.error('Ошибка загрузки истории');
    } finally {
      setTxLoading(false);
    }
  };

  const handleSelect = (item: Consumable) => {
    setSelected(item);
    void loadTransactions(item.id);
  };

  const handleTransaction = async (values: { delta: number; notes?: string }) => {
    if (!selected || !txType) return;
    setTxSubmitting(true);
    try {
      await consumablesService.addTransaction(selected.id, txType, values.delta, values.notes);
      txForm.resetFields();
      setTxType(null);
      onChanged();
      void loadTransactions(selected.id);
    } catch {
      void message.error('Ошибка при записи операции');
    } finally {
      setTxSubmitting(false);
    }
  };

  const openAddForm = () => {
    setEditTarget(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ category: 'hygiene', unit: 'шт', quantity: 0, minThreshold: 0 });
    setItemFormOpen(true);
  };

  const openEditForm = (item: Consumable) => {
    setEditTarget(item);
    itemForm.setFieldsValue({
      name: item.name,
      category: item.category,
      unit: item.unit,
      minThreshold: item.minThreshold,
      notes: item.notes ?? undefined,
    });
    setItemFormOpen(true);
  };

  const handleItemFormSubmit = async (values: ItemFormValues) => {
    setItemFormLoading(true);
    try {
      if (editTarget) {
        await consumablesService.update(editTarget.id, {
          name: values.name,
          category: values.category,
          unit: values.unit,
          minThreshold: values.minThreshold,
          notes: values.notes?.trim() || null,
        });
      } else {
        await consumablesService.add({
          name: values.name,
          category: values.category,
          unit: values.unit,
          quantity: values.quantity,
          minThreshold: values.minThreshold,
          notes: values.notes?.trim() || null,
        });
      }
      setItemFormOpen(false);
      onChanged();
      void message.success(editTarget ? 'Сохранено' : 'Добавлено');
    } catch {
      void message.error('Ошибка при сохранении');
    } finally {
      setItemFormLoading(false);
    }
  };

  const handleDelete = (item: Consumable) => {
    modal.confirm({
      title: `Удалить «${item.name}»?`,
      content: 'Вся история движений будет удалена.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await consumablesService.delete(item.id);
          if (selected?.id === item.id) setSelected(null);
          onChanged();
          void message.success('Удалено');
        } catch {
          void message.error('Ошибка при удалении');
        }
      },
    });
  };

  const filtered = consumables.filter((c) => catFilter === 'all' || c.category === catFilter);

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Consumable) => {
        const level = stockLevel(record.quantity, record.minThreshold);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 4, height: 32, borderRadius: 2, background: STOCK_COLOR[level], flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 500 }}>{name}</div>
              {record.notes && <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.notes}</div>}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Категория',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (cat: ConsumableCategory) => (
        <Tag color={CATEGORY_COLOR[cat]}>{CATEGORY_LABEL[cat]}</Tag>
      ),
    },
    {
      title: 'Остаток',
      key: 'quantity',
      width: 110,
      render: (_: unknown, record: Consumable) => {
        const level = stockLevel(record.quantity, record.minThreshold);
        return (
          <span style={{ color: STOCK_COLOR[level], fontWeight: 600, fontSize: 15 }}>
            {record.quantity} {record.unit}
          </span>
        );
      },
    },
    {
      title: 'Мин',
      dataIndex: 'minThreshold',
      key: 'minThreshold',
      width: 80,
      render: (min: number, record: Consumable) =>
        min > 0
          ? <Text type="secondary" style={{ fontSize: 12 }}>{min} {record.unit}</Text>
          : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    ...(canEdit ? [{
      title: '',
      key: 'actions',
      width: 72,
      render: (_: unknown, record: Consumable) => (
        <Space size={0}>
          <Tooltip title="Редактировать">
            <Button
              type="text" size="small" icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); openEditForm(record); }}
            />
          </Tooltip>
          <Tooltip title="Удалить">
            <Button
              type="text" danger size="small" icon={<DeleteOutlined />}
              onClick={(e) => { e.stopPropagation(); handleDelete(record); }}
            />
          </Tooltip>
        </Space>
      ),
    }] : []),
  ];

  const txColumns = [
    {
      title: 'Дата',
      dataIndex: 'recordedAt',
      key: 'recordedAt',
      width: 130,
      render: (d: Date) => d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: 'Операция',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (t: string) => <Tag color={TX_COLOR[t]}>{TX_LABEL[t]}</Tag>,
    },
    {
      title: 'Кол-во',
      key: 'delta',
      width: 80,
      render: (_: unknown, row: ConsumableTransaction) => (
        <span style={{ color: row.type === 'in' ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
          {row.type === 'in' ? '+' : '−'}{row.delta} {selected?.unit}
        </span>
      ),
    },
    {
      title: 'Кто',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string | null) => name ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Комментарий',
      dataIndex: 'notes',
      key: 'notes',
      render: (n: string | null) => n ?? <Text type="secondary">—</Text>,
    },
  ];

  const txTypeLabel = txType === 'in' ? 'Приход' : txType === 'out' ? 'Расход' : 'Списание';

  return (
    <div style={{ padding: '16px 24px', maxWidth: 900 }}>
      <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        Расходные материалы
      </Typography.Title>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          size="small"
          style={{ width: 140 }}
          value={catFilter}
          onChange={setCatFilter}
          options={[{ value: 'all', label: 'Все категории' }, ...CATEGORY_OPTIONS]}
        />
        {canEdit && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAddForm} style={{ marginLeft: 'auto' }}>
            Добавить
          </Button>
        )}
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 500 }}
        onRow={(record) => ({ onClick: () => handleSelect(record), style: { cursor: 'pointer' } })}
        locale={{ emptyText: 'Расходники не добавлены' }}
      />

      {/* Карточка расходника */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{selected?.name}</span>
            {selected && <Tag color={CATEGORY_COLOR[selected.category]}>{CATEGORY_LABEL[selected.category]}</Tag>}
          </div>
        }
        open={!!selected}
        onClose={() => setSelected(null)}
        width={520}
        extra={canEdit && selected && (
          <Tooltip title="Редактировать">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditForm(selected)} />
          </Tooltip>
        )}
      >
        {selected && (() => {
          const level = stockLevel(selected.quantity, selected.minThreshold);
          return (
            <>
              <div style={{
                background: level === 'critical' ? '#fff2f0' : level === 'low' ? '#fffbe6' : '#f6ffed',
                border: `1px solid ${STOCK_COLOR[level]}40`,
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: STOCK_COLOR[level], lineHeight: 1 }}>
                    {selected.quantity}
                  </div>
                  <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4 }}>{selected.unit}</div>
                </div>
                {selected.minThreshold > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>Минимум</div>
                    <div style={{ fontWeight: 500 }}>{selected.minThreshold} {selected.unit}</div>
                  </div>
                )}
              </div>

              {canEdit && (
                <Space style={{ marginBottom: 20 }}>
                  <Button icon={<ArrowUpOutlined />} type="primary" ghost onClick={() => setTxType('in')}>
                    Приход
                  </Button>
                  <Button icon={<ArrowDownOutlined />} onClick={() => setTxType('out')}>
                    Расход
                  </Button>
                  <Button icon={<CloseOutlined />} danger onClick={() => setTxType('writeoff')}>
                    Списать
                  </Button>
                </Space>
              )}

              {selected.notes && (
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{selected.notes}</Text>
                </div>
              )}

              <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>История движений</div>
              <Table
                dataSource={transactions}
                columns={txColumns}
                rowKey="id"
                size="small"
                loading={txLoading}
                pagination={{ pageSize: 20, size: 'small', hideOnSinglePage: true }}
                locale={{ emptyText: 'Нет операций' }}
              />
            </>
          );
        })()}
      </Drawer>

      {/* Форма операции */}
      <Modal
        title={txTypeLabel}
        open={!!txType}
        onCancel={() => { setTxType(null); txForm.resetFields(); }}
        footer={null}
        width={360}
      >
        <Form form={txForm} layout="vertical" onFinish={(v) => void handleTransaction(v)} style={{ marginTop: 16 }}>
          <Form.Item
            name="delta"
            label="Количество"
            rules={[{ required: true, message: 'Введите количество' }, { type: 'number', min: 1, message: 'Минимум 1' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} addonAfter={selected?.unit ?? 'шт'} />
          </Form.Item>
          <Form.Item name="notes" label="Комментарий">
            <Input placeholder="Необязательно" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={txSubmitting} block>
              {txTypeLabel}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Форма добавления/редактирования */}
      <Modal
        title={editTarget ? 'Редактировать расходник' : 'Добавить расходник'}
        open={itemFormOpen}
        onCancel={() => setItemFormOpen(false)}
        footer={null}
        width={440}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={(v) => void handleItemFormSubmit(v)}
          style={{ marginTop: 16 }}
        >
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder="Туалетная бумага" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
              <Select options={CATEGORY_OPTIONS} />
            </Form.Item>
            <Form.Item name="unit" label="Единица" rules={[{ required: true }]}>
              <Select options={UNIT_OPTIONS} />
            </Form.Item>
            {!editTarget && (
              <Form.Item name="quantity" label="Начальный остаток">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            )}
            <Form.Item name="minThreshold" label="Минимум">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Комментарий">
            <Input placeholder="Необязательно" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={itemFormLoading} block>
              {editTarget ? 'Сохранить' : 'Добавить'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
