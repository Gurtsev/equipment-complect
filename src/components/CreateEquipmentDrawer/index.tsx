import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  Upload,
  App,
  Grid,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { Equipment, EquipmentCategory, EquipmentLocation, EquipmentStatus } from '../../models/Equipment';
import { supabase } from '../../services/supabase';

const CATEGORIES: Array<{ label: string; value: EquipmentCategory }> = [
  { label: '📹 Камера', value: 'camera' },
  { label: '🎤 Микрофон', value: 'microphone' },
  { label: '💡 Свет', value: 'light' },
  { label: '💻 Компьютер', value: 'computer' },
  { label: '🎧 Аудио', value: 'audio' },
  { label: '🔧 Аксессуар', value: 'accessory' },
  { label: '🔭 Оптика', value: 'optics' },
  { label: '📱 Телефон', value: 'phone' },
];

interface FormValues {
  model: string;
  subtitle: string;
  category: EquipmentCategory;
  description: string;
  image: string;
  invNumber: string;
  serialNumber: string;
  responsible: string;
  accessories: Array<{ name: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (equipment: Equipment) => void;
  initialEquipment?: Equipment;
  onUpdated?: (equipment: Equipment) => void;
}

function generateId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `EQP-${num}`;
}

export function CreateEquipmentDrawer({ open, onClose, onCreated, initialEquipment, onUpdated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initialEquipment;
  const screens = Grid.useBreakpoint();
  const drawerWidth = screens.md ? 480 : '100%';
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialEquipment) {
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
      });
      setFileList(
        initialEquipment.image
          ? [{ uid: '-1', name: 'photo', status: 'done', url: initialEquipment.image }]
          : [],
      );
    } else {
      form.resetFields();
      setFileList([]);
    }
  }, [open, initialEquipment, form]);

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

  const handleFinish = (values: FormValues) => {
    if (isEdit && initialEquipment && onUpdated) {
      const updated = new Equipment({
        id: initialEquipment.id,
        model: values.model.trim(),
        subtitle: values.subtitle?.trim() ?? '',
        category: values.category,
        description: values.description?.trim() ?? '',
        image: values.image?.trim() ?? '',
        invNumber: initialEquipment.invNumber,
        serialNumber: values.serialNumber?.trim() ?? '',
        responsible: values.responsible.trim(),
        accessories: (values.accessories ?? []).map((a) => a.name).filter(Boolean),
        history: initialEquipment.history,
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
      category: values.category,
      description: values.description?.trim() ?? '',
      image: values.image?.trim() ?? '',
      invNumber: values.invNumber.trim(),
      serialNumber: values.serialNumber?.trim() ?? '',
      responsible: values.responsible.trim(),
      accessories: (values.accessories ?? []).map((a) => a.name).filter(Boolean),
      history: [
        {
          date: new Date(),
          status: 'На Складе' as EquipmentStatus,
          location: 'Склад' as EquipmentLocation,
          responsible: values.responsible.trim(),
        },
      ],
    });

    onCreated(equipment);
    void message.success(`${equipment.model} добавлено в каталог`);
    onClose();
  };

  return (
    <Drawer
      title={isEdit ? 'Редактировать оборудование' : 'Новое оборудование'}
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
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark="optional"
      >
        <Form.Item
          name="model"
          label="Модель"
          rules={[{ required: true, message: 'Введите название модели' }]}
        >
          <Input placeholder="Sony ILME-FX6" />
        </Form.Item>

        <Form.Item name="subtitle" label="Подзаголовок">
          <Input placeholder="Кинокамера Full-Frame 4K" />
        </Form.Item>

        <Form.Item
          name="category"
          label="Категория"
          rules={[{ required: true, message: 'Выберите категорию' }]}
        >
          <Select placeholder="Выберите категорию" options={CATEGORIES} />
        </Form.Item>

        <Form.Item name="description" label="Описание">
          <Input.TextArea rows={2} placeholder="Краткое описание характеристик" />
        </Form.Item>

        <Form.Item label="Фотография">
          <Upload {...uploadProps}>
            {fileList.length === 0 && (
              <Button icon={<UploadOutlined />}>Загрузить фото</Button>
            )}
          </Upload>
        </Form.Item>
        <Form.Item name="image" hidden>
          <Input />
        </Form.Item>

        <Form.Item
          name="invNumber"
          label="Инвентарный номер"
          rules={[{ required: true, message: 'Введите инвентарный номер' }]}
        >
          <Input placeholder="INV-2024-0001" disabled={isEdit} />
        </Form.Item>

        <Form.Item name="serialNumber" label="Серийный номер">
          <Input placeholder="SN-..." />
        </Form.Item>

        <Form.Item
          name="responsible"
          label="Ответственный"
          rules={[{ required: true, message: 'Укажите ответственного' }]}
        >
          <Input placeholder="Иван Петров" />
        </Form.Item>

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
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  style={{ width: '100%' }}
                  size="small"
                >
                  Добавить позицию
                </Button>
              </Space>
            </Form.Item>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}
