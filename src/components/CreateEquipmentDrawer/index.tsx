import { useEffect, useState } from 'react';
import {
  Drawer, Form, Input, InputNumber, Select, Button, Space,
  Upload, App, Grid, TreeSelect, Segmented,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Equipment, EquipmentCategory,
  EquipmentLocation, EquipmentSection, EquipmentStatus,
} from '../../models/Equipment';
import { supabase } from '../../services/supabase';
import { buildRoomTree, OFFICE_LABEL } from '../../services/roomService';
import type { Room, RoomTreeNode } from '../../services/roomService';

// ── Категории по разделам ────────────────────────────────────────────────────

const TECH_CATEGORIES: Array<{ label: string; value: EquipmentCategory }> = [
  { label: 'Камера', value: 'camera' },
  { label: 'Микрофон', value: 'microphone' },
  { label: 'Свет', value: 'light' },
  { label: 'Компьютер', value: 'computer' },
  { label: 'Ноутбук', value: 'laptop' },
  { label: 'Телевизор', value: 'tv' },
  { label: 'Аудио', value: 'audio' },
  { label: 'Оптика', value: 'optics' },
  { label: 'Телефон', value: 'phone' },
  { label: 'Инструмент', value: 'tool' },
  { label: 'Аксессуар', value: 'accessory' },
  { label: 'Стойка/Штатив', value: 'stand' },
];

const PROP_CATEGORIES: Array<{ label: string; value: EquipmentCategory }> = [
  { label: 'Реквизит', value: 'prop' },
  { label: 'Аксессуар', value: 'accessory' },
];

const SECTION_OPTIONS = [
  { label: 'Техника', value: 'tech' },
  { label: 'Мебель', value: 'furniture' },
  { label: 'Реквизит', value: 'prop' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toTreeData(nodes: RoomTreeNode[]): object[] {
  return nodes.map((n) => ({
    title: n.name,
    value: n.id,
    key: n.id,
    children: n.children.length > 0 ? toTreeData(n.children) : undefined,
    selectable: n.children.length === 0,
  }));
}

function buildOfficeTree(rooms: Room[]): object[] {
  const offices = ['A', 'B', 'C'] as const;
  return offices
    .filter((o) => rooms.some((r) => r.office === o))
    .map((office) => ({
      title: OFFICE_LABEL[office],
      value: `office-${office}`,
      key: `office-${office}`,
      selectable: false,
      children: toTreeData(buildRoomTree(rooms.filter((r) => r.office === office))),
    }));
}

function generateId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `EQP-${num}`;
}

function sectionFromCategory(cat: EquipmentCategory): EquipmentSection {
  if (cat === 'furniture') return 'furniture';
  if (cat === 'prop') return 'prop';
  return 'tech';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface FormValues {
  model: string;
  subtitle?: string;
  category?: EquipmentCategory;
  description?: string;
  image?: string;
  invNumber: string;
  serialNumber?: string;
  responsible?: string;
  accessories?: Array<{ name: string }>;
  roomId?: string;
  quantity?: number;
  attributes?: Array<{ key: string; value: string }>;
  parentId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (equipment: Equipment) => void;
  initialEquipment?: Equipment;
  onUpdated?: (equipment: Equipment) => void;
  duplicateSource?: Equipment;
  rooms?: Room[];
  allEquipment?: Equipment[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function CreateEquipmentDrawer({ open, onClose, onCreated, initialEquipment, onUpdated, duplicateSource, rooms = [], allEquipment = [] }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initialEquipment;
  const screens = Grid.useBreakpoint();
  const drawerWidth = screens.md ? 480 : '100%';
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [section, setSection] = useState<EquipmentSection>('tech');
  const [snLoading, setSnLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialEquipment) {
      const sec = initialEquipment.section ?? sectionFromCategory(initialEquipment.category);
      setSection(sec);
      const attrs = initialEquipment.attributes
        ? Object.entries(initialEquipment.attributes).map(([key, value]) => ({ key, value }))
        : [];
      form.setFieldsValue({
        model: initialEquipment.model,
        subtitle: initialEquipment.subtitle,
        category: initialEquipment.category,
        description: initialEquipment.description,
        image: initialEquipment.image,
        invNumber: initialEquipment.invNumber,
        serialNumber: initialEquipment.serialNumber,
        responsible: initialEquipment.responsible,
        accessories: initialEquipment.accessories.map((name) => ({ name })),
        roomId: initialEquipment.roomId ?? undefined,
        quantity: initialEquipment.quantity ?? undefined,
        attributes: attrs,
        parentId: initialEquipment.parentId ?? undefined,
      });
      setFileList(
        initialEquipment.image
          ? [{ uid: '-1', name: 'photo', status: 'done', url: initialEquipment.image }]
          : [],
      );
    } else if (duplicateSource) {
      const sec = duplicateSource.section ?? sectionFromCategory(duplicateSource.category);
      setSection(sec);
      const attrs = duplicateSource.attributes
        ? Object.entries(duplicateSource.attributes).map(([key, value]) => ({ key, value }))
        : [];
      form.setFieldsValue({
        model: duplicateSource.model,
        subtitle: duplicateSource.subtitle,
        category: duplicateSource.category,
        description: duplicateSource.description,
        image: duplicateSource.image,
        invNumber: '',
        serialNumber: '',
        responsible: duplicateSource.responsible,
        accessories: duplicateSource.accessories.map((name) => ({ name })),
        roomId: duplicateSource.roomId ?? undefined,
        quantity: duplicateSource.quantity ?? undefined,
        attributes: attrs,
        parentId: undefined,
      });
      setFileList(
        duplicateSource.image
          ? [{ uid: '-1', name: 'photo', status: 'done', url: duplicateSource.image }]
          : [],
      );
    } else {
      setSection('tech');
      form.resetFields();
      setFileList([]);
    }
  }, [open, initialEquipment, duplicateSource, form]);

  const uploadProps: UploadProps = {
    listType: 'picture',
    maxCount: 1,
    fileList,
    onChange: ({ fileList: newList, file }) => {
      setFileList(newList);
      if (file.status === 'removed') form.setFieldValue('image', '');
    },
    customRequest: async ({ file, onSuccess, onError }) => {
      const f = file as File;
      const ext = f.name.split('.').pop() ?? 'jpg';
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('equipment-images')
        .upload(path, f, { cacheControl: '3600', upsert: false });
      if (error) {
        onError?.(new Error(error.message));
        void message.error('Ошибка загрузки фото');
        return;
      }
      const { data } = supabase.storage.from('equipment-images').getPublicUrl(path);
      form.setFieldValue('image', data.publicUrl);
      onSuccess?.({});
    },
  };

  const buildAttributes = (list?: Array<{ key: string; value: string }>): Record<string, string> | null => {
    if (!list || list.length === 0) return null;
    const result: Record<string, string> = {};
    list.forEach(({ key, value }) => {
      if (key?.trim()) result[key.trim()] = value?.trim() ?? '';
    });
    return Object.keys(result).length > 0 ? result : null;
  };

  const handleGenerateSN = async () => {
    setSnLoading(true);
    try {
      const year = new Date().getFullYear();
      const prefix = `SN-INT-${year}-`;
      const { data } = await supabase
        .from('equipment')
        .select('serial_number')
        .like('serial_number', `${prefix}%`);
      let maxNum = 0;
      for (const row of data ?? []) {
        const num = parseInt((row.serial_number as string).replace(prefix, ''), 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
      form.setFieldValue('serialNumber', `${prefix}${String(maxNum + 1).padStart(4, '0')}`);
    } catch {
      void message.error('Не удалось сгенерировать номер');
    } finally {
      setSnLoading(false);
    }
  };

  const resolveCategory = (values: FormValues): EquipmentCategory => {
    if (section === 'furniture') return 'furniture';
    return values.category ?? (section === 'prop' ? 'prop' : 'camera');
  };

  const handleFinish = (values: FormValues) => {
    const category = resolveCategory(values);
    const attributes = buildAttributes(values.attributes);

    if (isEdit && initialEquipment && onUpdated) {
      const updated = new Equipment({
        id: initialEquipment.id,
        model: values.model.trim(),
        subtitle: values.subtitle?.trim() ?? '',
        category,
        section,
        description: values.description?.trim() ?? '',
        image: values.image?.trim() ?? '',
        invNumber: initialEquipment.invNumber,
        serialNumber: values.serialNumber?.trim() ?? '',
        responsible: values.responsible?.trim() ?? '',
        accessories: (values.accessories ?? []).map((a) => a.name).filter(Boolean),
        history: initialEquipment.history,
        roomId: values.roomId ?? null,
        attributes,
        quantity: values.quantity ?? null,
        parentId: values.parentId ?? null,
        assemblyStatus: initialEquipment.assemblyStatus,
      });
      onUpdated(updated);
      void message.success(`${updated.model} обновлено`);
      onClose();
      return;
    }

    const equipment = new Equipment({
      id: generateId(),
      model: values.model.trim(),
      subtitle: values.subtitle?.trim() ?? '',
      category,
      section,
      description: values.description?.trim() ?? '',
      image: values.image?.trim() ?? '',
      invNumber: (values.invNumber ?? '').trim(),
      serialNumber: values.serialNumber?.trim() ?? '',
      responsible: values.responsible?.trim() ?? '',
      accessories: (values.accessories ?? []).map((a) => a.name).filter(Boolean),
      roomId: values.roomId ?? null,
      attributes,
      quantity: values.quantity ?? null,
      parentId: values.parentId ?? null,
      history: [{
        date: new Date(),
        status: 'На Складе' as EquipmentStatus,
        location: 'Склад' as EquipmentLocation,
        responsible: values.responsible?.trim() ?? '',
      }],
    });

    onCreated(equipment);
    void message.success(`${equipment.model} добавлено в каталог`);
    onClose();
  };

  const isTech = section === 'tech';
  const isFurniture = section === 'furniture';
  const isProp = section === 'prop';

  const parentOptions = allEquipment
    .filter((e) => !e.parentId && e.id !== initialEquipment?.id)
    .map((e) => ({ value: e.id, label: `${e.model}${e.subtitle ? ' — ' + e.subtitle : ''}` }));

  return (
    <Drawer
      title={isEdit ? 'Редактировать' : 'Новая запись'}
      open={open}
      onClose={onClose}
      width={drawerWidth}
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">

        {/* Раздел */}
        {!isEdit && (
          <Form.Item label="Раздел">
            <Segmented
              options={SECTION_OPTIONS}
              value={section}
              onChange={(v) => {
                setSection(v as EquipmentSection);
                form.setFieldValue('category', undefined);
              }}
              block
            />
          </Form.Item>
        )}

        {/* Название */}
        <Form.Item
          name="model"
          label="Название"
          rules={[{ required: true, message: 'Введите название' }]}
        >
          <Input placeholder={isTech ? 'Sony ILME-FX6' : isFurniture ? 'Стол переговорный' : 'Новогодние шарики'} />
        </Form.Item>

        <Form.Item name="subtitle" label="Подзаголовок">
          <Input placeholder={isTech ? 'Кинокамера Full-Frame 4K' : isFurniture ? '180×90 см, белый' : 'Красные, 5 см'} />
        </Form.Item>

        {/* Категория — только для Техники и Реквизита */}
        {(isTech || isProp) && (
          <Form.Item
            name="category"
            label="Категория"
            rules={[{ required: true, message: 'Выберите категорию' }]}
          >
            <Select
              placeholder="Выберите категорию"
              options={isTech ? TECH_CATEGORIES : PROP_CATEGORIES}
            />
          </Form.Item>
        )}

        {/* Помещение */}
        {rooms.length > 0 && (
          <Form.Item name="roomId" label="Помещение">
            <TreeSelect
              treeData={buildOfficeTree(rooms)}
              placeholder="Выберите помещение"
              allowClear
              showSearch
              treeNodeFilterProp="title"
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}

        {/* Входит в состав комплекта — только Техника */}
        {isTech && (
          <Form.Item name="parentId" label="Входит в состав">
            <Select
              placeholder="Не входит в комплект"
              allowClear
              showSearch
              options={parentOptions}
              filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        )}

        {/* Фото */}
        <Form.Item label="Фотография">
          <Upload {...uploadProps}>
            {fileList.length === 0 && <Button icon={<UploadOutlined />}>Загрузить фото</Button>}
          </Upload>
        </Form.Item>
        <Form.Item name="image" hidden><Input /></Form.Item>

        {/* Инв. номер */}
        <Form.Item name="invNumber" label="Инвентарный номер">
          <Input placeholder="INV-2024-0001" disabled={isEdit} />
        </Form.Item>

        {/* Серийный номер — только Техника */}
        {isTech && (
          <Form.Item name="serialNumber" label="Серийный номер">
            <Input
              placeholder="SN-INT-2025-0001"
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  loading={snLoading}
                  onClick={handleGenerateSN}
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                >
                  Сгенерировать
                </Button>
              }
            />
          </Form.Item>
        )}

        {/* Количество — только Реквизит */}
        {isProp && (
          <Form.Item name="quantity" label="Количество">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="20" />
          </Form.Item>
        )}

        {/* Ответственный — Техника и Мебель */}
        {(isTech || isFurniture) && (
          <Form.Item name="responsible" label="Ответственный">
            <Input placeholder="Иван Петров" />
          </Form.Item>
        )}

        {/* Комплектация — только Техника */}
        {isTech && (
          <Form.List name="accessories">
            {(fields, { add, remove }) => (
              <Form.Item label="Комплектация">
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ width: '100%' }}>
                      <Form.Item
                        {...rest}
                        name={[name, 'name']}
                        rules={[{ required: true, message: '' }]}
                        style={{ margin: 0, flex: 1 }}
                      >
                        <Input placeholder="Название аксессуара" style={{ width: 340 }} />
                      </Form.Item>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ width: '100%' }} size="small">
                    Добавить позицию
                  </Button>
                </Space>
              </Form.Item>
            )}
          </Form.List>
        )}

        {/* Атрибуты — Мебель и Реквизит */}
        {(isFurniture || isProp) && (
          <Form.List name="attributes">
            {(fields, { add, remove }) => (
              <Form.Item label="Атрибуты">
                <Space direction="vertical" style={{ width: '100%' }} size={6}>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ width: '100%' }} size={8}>
                      <Form.Item
                        {...rest}
                        name={[name, 'key']}
                        rules={[{ required: true, message: '' }]}
                        style={{ margin: 0 }}
                      >
                        <Input placeholder={isFurniture ? 'Высота' : 'Цвет'} style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item
                        {...rest}
                        name={[name, 'value']}
                        style={{ margin: 0 }}
                      >
                        <Input placeholder={isFurniture ? '75 см' : 'Красный'} style={{ width: 170 }} />
                      </Form.Item>
                      <MinusCircleOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                      />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ width: '100%' }} size="small">
                    Добавить атрибут
                  </Button>
                </Space>
              </Form.Item>
            )}
          </Form.List>
        )}

        {/* Описание */}
        <Form.Item name="description" label="Описание">
          <Input.TextArea rows={2} placeholder="Краткое описание" />
        </Form.Item>

      </Form>
    </Drawer>
  );
}
