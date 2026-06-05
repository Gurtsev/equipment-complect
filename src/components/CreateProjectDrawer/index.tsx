import { useEffect, useState } from 'react';
import { Drawer, Form, Input, Button, Space, DatePicker, App, Grid, Radio } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Project, ProjectData } from '../../models/Project';

type LocationType = 'Романов' | 'Знаменка' | 'Выезд';

interface FormValues {
  name: string;
  client: string;
  startDate: Dayjs;
  endDate: Dayjs;
  locationType: LocationType;
  locationAddress?: string;
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

function parseLocation(location: string): { locationType: LocationType; locationAddress: string } {
  if (location === 'Романов' || location === 'Знаменка') {
    return { locationType: location, locationAddress: '' };
  }
  if (location.startsWith('Выезд')) {
    return {
      locationType: 'Выезд',
      locationAddress: location.startsWith('Выезд: ') ? location.slice(7) : '',
    };
  }
  return { locationType: 'Романов', locationAddress: '' };
}

export function CreateProjectDrawer({ open, onClose, onCreated, initialProject, onUpdated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initialProject;
  const screens = Grid.useBreakpoint();
  const drawerWidth = screens.md ? 480 : '100%';
  const [locationType, setLocationType] = useState<LocationType>('Романов');

  useEffect(() => {
    if (!open) return;
    if (initialProject) {
      const { locationType: lt, locationAddress } = parseLocation(initialProject.location);
      setLocationType(lt);
      form.setFieldsValue({
        name: initialProject.name,
        client: initialProject.client,
        startDate: dayjs(initialProject.startDate),
        endDate: dayjs(initialProject.endDate),
        locationType: lt,
        locationAddress,
        responsible: initialProject.responsible,
        notes: initialProject.notes,
      });
    } else {
      setLocationType('Романов');
      form.resetFields();
    }
  }, [open, initialProject, form]);

  const handleFinish = (values: FormValues) => {
    const location =
      values.locationType === 'Выезд' && values.locationAddress?.trim()
        ? `Выезд: ${values.locationAddress.trim()}`
        : values.locationType;

    const data: ProjectData = {
      id: isEdit ? initialProject!.id : generateProjectId(),
      name: values.name.trim(),
      client: values.client?.trim() ?? '',
      startDate: values.startDate.toDate(),
      endDate: values.endDate.toDate(),
      location,
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
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" showTime={{ format: 'HH:mm', minuteStep: 15 }} />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="Дата окончания"
            rules={[{ required: true, message: 'Укажите дату' }]}
            style={{ flex: 1 }}
          >
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY HH:mm" showTime={{ format: 'HH:mm', minuteStep: 15 }} />
          </Form.Item>
        </Space>

        <Form.Item
          name="locationType"
          label="Локация"
          rules={[{ required: true, message: 'Выберите локацию' }]}
          initialValue="Романов"
        >
          <Radio.Group onChange={(e) => setLocationType(e.target.value as LocationType)}>
            <Radio value="Романов">Романов</Radio>
            <Radio value="Знаменка">Знаменка</Radio>
            <Radio value="Выезд">Выезд</Radio>
          </Radio.Group>
        </Form.Item>

        {locationType === 'Выезд' && (
          <Form.Item name="locationAddress" label="Адрес площадки">
            <Input placeholder="Без адреса — просто «Выезд»" />
          </Form.Item>
        )}

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
