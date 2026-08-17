import { useState } from 'react';
import { Drawer, Button, List, Empty, App, Input, Select, Form, Typography, Space, Popconfirm } from 'antd';
import { DeleteOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { cartService } from '../../services/cartService';
import { listService } from '../../services/listService';
import type { CartItem } from '../../services/cartService';
import type { EquipmentList } from '../../services/listService';
import type { Equipment } from '../../models/Equipment';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  allEquipment: Equipment[];
  lists: EquipmentList[];
  onCartChanged: () => Promise<void>;
  onListsChanged: () => Promise<void>;
}

type Mode = 'cart' | 'create' | 'add-to-existing';

export function CartDrawer({
  open,
  onClose,
  cartItems,
  allEquipment,
  lists,
  onCartChanged,
  onListsChanged,
}: Props) {
  const { message } = App.useApp();
  const [mode, setMode] = useState<Mode>('cart');
  const [loading, setLoading] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | undefined>(undefined);

  const equipmentMap = new Map(allEquipment.map((e) => [e.id, e]));
  const draftLists = lists.filter((l) => !l.isArchived);

  const handleRemove = async (equipmentId: string) => {
    try {
      await cartService.removeItem(equipmentId);
      await onCartChanged();
    } catch {
      void message.error('Ошибка при удалении из корзины');
    }
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await listService.create(name, cartItems.map((i) => i.equipmentId));
      await cartService.clear();
      await Promise.all([onCartChanged(), onListsChanged()]);
      void message.success(`Список «${name}» создан`);
      setNewListName('');
      setMode('cart');
      onClose();
    } catch {
      void message.error('Ошибка при создании списка');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToExisting = async () => {
    if (!selectedListId) return;
    setLoading(true);
    try {
      await listService.addToExisting(selectedListId, cartItems.map((i) => i.equipmentId));
      await cartService.clear();
      await Promise.all([onCartChanged(), onListsChanged()]);
      const list = lists.find((l) => l.id === selectedListId);
      void message.success(`Добавлено в список «${list?.name ?? ''}»`);
      setSelectedListId(undefined);
      setMode('cart');
      onClose();
    } catch {
      void message.error('Ошибка при добавлении в список');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode('cart');
    setNewListName('');
    setSelectedListId(undefined);
    onClose();
  };

  const cartContent = (
    <>
      {cartItems.length === 0 ? (
        <Empty description="Корзина пуста" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
      ) : (
        <List
          dataSource={cartItems}
          renderItem={(item) => {
            const eq = equipmentMap.get(item.equipmentId);
            return (
              <List.Item
                extra={
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => void handleRemove(item.equipmentId)}
                  />
                }
              >
                <List.Item.Meta
                  title={eq?.model ?? item.equipmentId}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {eq?.invNumber ?? '—'}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      {cartItems.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={() => setMode('create')}
          >
            Создать новый список
          </Button>
          {draftLists.length > 0 && (
            <Button
              icon={<UnorderedListOutlined />}
              block
              onClick={() => setMode('add-to-existing')}
            >
              Добавить в существующий
            </Button>
          )}
        </div>
      )}
    </>
  );

  const createContent = (
    <Form layout="vertical" onFinish={() => void handleCreateList()}>
      <Form.Item label="Название списка" required>
        <Input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="Например: Съёмка 24 августа"
          autoFocus
        />
      </Form.Item>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 16 }}>
        Будет добавлено {cartItems.length} поз.
      </div>
      <Space>
        <Button onClick={() => setMode('cart')}>Назад</Button>
        <Button type="primary" htmlType="submit" loading={loading} disabled={!newListName.trim()}>
          Создать
        </Button>
      </Space>
    </Form>
  );

  const addToExistingContent = (
    <Form layout="vertical" onFinish={() => void handleAddToExisting()}>
      <Form.Item label="Выберите список">
        <Select
          value={selectedListId}
          onChange={setSelectedListId}
          placeholder="Выберите список..."
          style={{ width: '100%' }}
          options={draftLists.map((l) => ({
            value: l.id,
            label: `${l.name} (${l.equipmentIds.length} поз.)`,
          }))}
          autoFocus
        />
      </Form.Item>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 16 }}>
        Будет добавлено {cartItems.length} поз.
      </div>
      <Space>
        <Button onClick={() => setMode('cart')}>Назад</Button>
        <Button type="primary" htmlType="submit" loading={loading} disabled={!selectedListId}>
          Добавить
        </Button>
      </Space>
    </Form>
  );

  const titles: Record<Mode, string> = {
    cart: `Корзина${cartItems.length > 0 ? ` (${cartItems.length})` : ''}`,
    create: 'Новый список',
    'add-to-existing': 'Добавить в список',
  };

  return (
    <Drawer
      title={titles[mode]}
      open={open}
      onClose={handleClose}
      width={360}
      extra={
        mode === 'cart' && cartItems.length > 0 && (
          <Popconfirm
            title="Очистить корзину?"
            okText="Очистить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={async () => {
              await cartService.clear();
              await onCartChanged();
            }}
          >
            <Button type="text" danger size="small">Очистить</Button>
          </Popconfirm>
        )
      }
    >
      {mode === 'cart' && cartContent}
      {mode === 'create' && createContent}
      {mode === 'add-to-existing' && addToExistingContent}
    </Drawer>
  );
}
