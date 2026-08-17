import { useState } from 'react';
import { Typography, List, Tag, Button, Empty, App, Popconfirm, Input, Space, Tooltip, Collapse } from 'antd';
import {
  EditOutlined, DeleteOutlined, CopyOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { listService } from '../../services/listService';
import type { EquipmentList } from '../../services/listService';
import type { Equipment } from '../../models/Equipment';

const { Text, Title } = Typography;

interface Props {
  lists: EquipmentList[];
  allEquipment: Equipment[];
  canEdit: boolean;
  onListsChanged: () => Promise<void>;
}

function ListStatusTag({ list }: { list: EquipmentList }) {
  if (list.isArchived) return <Tag color="default">Архив</Tag>;
  return <Tag color="green">Шаблон</Tag>;
}

export function ListsPage({ lists, allEquipment, canEdit, onListsChanged }: Props) {
  const { message } = App.useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const equipmentMap = new Map(allEquipment.map((e) => [e.id, e]));

  const activeLists = lists.filter((l) => !l.isArchived);
  const archivedLists = lists.filter((l) => l.isArchived);

  const handleRename = async (listId: string) => {
    const name = editingName.trim();
    if (!name) return;
    setLoading(listId);
    try {
      await listService.rename(listId, name);
      await onListsChanged();
      setEditingId(null);
    } catch {
      void message.error('Ошибка при переименовании');
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = async (list: EquipmentList) => {
    setLoading(list.id);
    try {
      await listService.copyAsTemplate(list.id, `${list.name} (копия)`);
      await onListsChanged();
      void message.success('Список скопирован');
    } catch {
      void message.error('Ошибка при копировании');
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (list: EquipmentList) => {
    setLoading(list.id);
    try {
      await listService.delete(list.id);
      await onListsChanged();
    } catch {
      void message.error('Ошибка при удалении');
    } finally {
      setLoading(null);
    }
  };

  const renderList = (list: EquipmentList) => {
    const isLoading = loading === list.id;
    const isEditing = editingId === list.id;
    return (
      <List.Item
        key={list.id}
        style={{ alignItems: 'flex-start', padding: '12px 0' }}
        actions={canEdit ? [
          isEditing ? (
            <Space key="rename">
              <Button size="small" type="primary" loading={isLoading} onClick={() => void handleRename(list.id)}>
                Сохранить
              </Button>
              <Button size="small" onClick={() => setEditingId(null)}>Отмена</Button>
            </Space>
          ) : (
            <Space key="actions" size={4}>
              <Tooltip title="Переименовать">
                <Button
                  type="text" size="small" icon={<EditOutlined />}
                  onClick={() => { setEditingId(list.id); setEditingName(list.name); }}
                />
              </Tooltip>
              <Tooltip title="Скопировать как шаблон">
                <Button type="text" size="small" icon={<CopyOutlined />} loading={isLoading} onClick={() => void handleCopy(list)} />
              </Tooltip>
              <Popconfirm
                title="Удалить список?"
                description="Уже наполненные из него проекты не изменятся."
                okText="Удалить"
                okButtonProps={{ danger: true }}
                cancelText="Отмена"
                onConfirm={() => void handleDelete(list)}
              >
                <Tooltip title="Удалить">
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </Space>
          ),
        ] : []}
      >
        <List.Item.Meta
          title={
            isEditing ? (
              <Input
                size="small"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onPressEnter={() => void handleRename(list.id)}
                autoFocus
                style={{ width: 220 }}
              />
            ) : (
              <Space size={8}>
                <Text strong>{list.name}</Text>
                <ListStatusTag list={list} />
              </Space>
            )
          }
          description={
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {list.equipmentIds.length} поз.
              </Text>
              {list.equipmentIds.length > 0 && (
                <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {list.equipmentIds.slice(0, 5).map((eid) => {
                    const eq = equipmentMap.get(eid);
                    return (
                      <Tag key={eid} style={{ fontSize: 11, margin: 0 }}>
                        {eq?.model ?? eid}
                      </Tag>
                    );
                  })}
                  {list.equipmentIds.length > 5 && (
                    <Tag style={{ fontSize: 11, margin: 0 }}>+{list.equipmentIds.length - 5}</Tag>
                  )}
                </div>
              )}
            </div>
          }
        />
      </List.Item>
    );
  };

  return (
    <div style={{ padding: '16px 24px', maxWidth: 800 }}>
      <Title level={4} style={{ marginTop: 0, marginBottom: 20 }}>
        Списки оборудования
      </Title>

      {lists.length === 0 ? (
        <Empty
          description="Нет списков. Соберите корзину в каталоге и создайте список."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <List
            dataSource={activeLists}
            renderItem={renderList}
            locale={{ emptyText: 'Нет активных списков' }}
          />

          {archivedLists.length > 0 && (
            <Collapse
              ghost
              style={{ marginTop: 16 }}
              items={[{
                key: 'archived',
                label: (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Архив ({archivedLists.length}) <DownOutlined style={{ fontSize: 10 }} />
                  </Text>
                ),
                children: (
                  <List
                    dataSource={archivedLists}
                    renderItem={renderList}
                  />
                ),
              }]}
            />
          )}
        </>
      )}
    </div>
  );
}
