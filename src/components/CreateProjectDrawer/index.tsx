import { useEffect } from 'react';
import { Drawer, Form, Input, Select, Button, Space, DatePicker, App } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Project, ProjectData } from '../../models/Project';
import { EquipmentLocation } from '../../models/Equipment';

const LOCATIONS: Array<{ label: string; value: EquipmentLocation }> = [
  { label: 'Студия Медиа Крыша', value: 'Студия Медиа Крыша' },
  { label: 'Студия на Романовом', value: 'Студия на Романовом' },
  { label: 'Склад', value: 'Склад' },
  { label: 'В пути', value: 'В пути' },
];

interface FormValues {
  name: string;
  client: string;
  startDate: Dayjs;
  endDate: Dayjs;
  location: EquipmentLocation;
  responsible: string;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  initialProject?: Project;
  onUpdated?: (project: Project) => void;
}

function generateProjectId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PRJ-${num}`;
}

export function CreateProjectDrawer({ open, onClose, onCreated, initialProject, onUpdated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initialProject;

  useEffect(() => {
    if (!open) return;
    if (initialProject) {
      form.setFieldsValue({
        name: initialProject.name,
        client: initialProject.client,
        startDate: dayjs(initialProject.startDate),
        endDate: dayjs(initialProject.endDate),
        location: initialProject.location,
        responsible: initialProject.responsible,
        notes: initialProject.notes,
      });
    } else {
      form.resetFields();
    }
  }, [open, initialProject, form]);

  const handleFinish = (values: FormValues) => {
    const data: ProjectData = {
      id: isEdit ? initialProject!.id : generateProjectId(),
      name: values.name.trim(),
      client: values.client?.trim() ?? '',
      startDate: values.startDate.toDate(),
      endDate: values.endDate.toDate(),
      location: values.location,
      responsible: values.responsible.trim(),
      status: isEdit ? initialProject!.status : 'Планируется',
      equipmentIds: isEdit ? initialProject!.equipmentIds : [],
      notes: values.notes?.trim() ?? '',
    };
    const project = new Project(data);

    if (isEdit && onUpdated) {
      onUpdated(project);
      void message.success(`Проект «${project.name}» обновлён`);
    } else {
      onCreated(project);
      void message.success(`Проект «${project.name}» создан`);
    }
    onClose();
  };

  return (
    <Drawer
      title={isEdit ? 'Редактировать проект' : 'Новый проект'}
      open={open}
      onClose={onClose}
      width={480}
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
        <Form.Item
          name="name"
          label="Название проекта"
          rules={[{ required: true, message: 'Введите название' }]}
        >
          <Input placeholder="Съёмка для РБК, 15 мая" />
        </Form.Item>

        <Form.Item name="client" label="Клиент / продакшн">
          <Input placeholder="РБК" />
        </Form.Item>

        <Space size={12} style={{ width: '100%', display: 'flex' }}>
          <Form.Item
            name="startDate"
            label="Дата начала"
            rules={[{ required: true, message: 'Укажите дату' }]}
            style={{ flex: 1 }}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="Дата окончания"
            rules={[{ required: true, message: 'Укажите дату' }]}
            style={{ flex: 1 }}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
        </Space>

        <Form.Item
          name="location"
          label="Локация съёмки"
          rules={[{ required: true, message: 'Выберите локацию' }]}
        >
          <Select placeholder="Куда едет техника" options={LOCATIONS} />
        </Form.Item>

        <Form.Item
          name="responsible"
          label="Ответственный"
          rules={[{ required: true, message: 'Укажите ответственного' }]}
        >
          <Input placeholder="Иван Петров" />
        </Form.Item>

        <Form.Item name="notes" label="Заметки">
          <Input.TextArea rows={3} placeholder="Дополнительная информация..." />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
