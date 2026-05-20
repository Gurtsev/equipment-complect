import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Typography,
  Tag,
  Button,
  Table,
  Modal,
  Input,
  Flex,
  Avatar,
  Tooltip,
  App,
  Popconfirm,
  Descriptions,
  Timeline,
  Spin,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  SendOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  PlusCircleOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { Project, ProjectStatus } from '../../models/Project';
import { Equipment, EquipmentStatus } from '../../models/Equipment';
import { historyService } from '../../services/historyService';
import { projectService } from '../../services/projectService';
import { projectHistoryService, ProjectHistoryEntry } from '../../services/projectHistoryService';

const { Title, Text } = Typography;

const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  'Планируется': 'blue',
  'Активен': 'green',
  'Завершён': 'default',
};

const EQUIPMENT_STATUS_COLOR: Record<EquipmentStatus, string> = {
  'В Работе': 'success',
  'На Складе': 'processing',
  'В Ремонте': 'warning',
  'Списано': 'error',
  'В Пути': 'purple',
  'Забронировано': 'cyan',
};

const HISTORY_LABEL: Record<string, string> = {
  equipment_added: 'добавил в комплект',
  equipment_removed: 'убрал из комплекта',
  activated: 'выдал оборудование (проект активен)',
  finished: 'завершил проект',
  created: 'создал проект',
  updated: 'обновил проект',
};

const HISTORY_COLOR: Record<string, string> = {
  equipment_added: 'green',
  equipment_removed: 'red',
  activated: 'blue',
  finished: 'gray',
  created: 'blue',
  updated: 'gray',
};

const HISTORY_ICON: Record<string, React.ReactNode> = {
  equipment_added: <PlusCircleOutlined />,
  equipment_removed: <MinusCircleOutlined />,
  activated: <PlayCircleOutlined />,
  finished: <CheckCircleOutlined />,
  created: <PlusCircleOutlined />,
  updated: <EditOutlined />,
};

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString('ru-RU')} — ${end.toLocaleDateString('ru-RU')}`;
}

function exportCompletion(project: Project, equipment: Equipment[]) {
  const rows = equipment.map((e) => ({
    'Инв. номер': e.invNumber,
    'Модель': e.model,
    'Серийный номер': e.serialNumber,
    'Статус': e.currentStatus,
    'Ответственный': e.responsible,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Комплект');
  XLSX.writeFile(wb, `project-${project.name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

interface Props {
  project: Project;
  allEquipment: Equipment[];
  canEdit: boolean;
  onEdit: () => void;
  onUpdate: (project: Project) => void;
  onEquipmentChange: () => void;
  getEquipmentProject: (equipmentId: string) => Project | undefined;
  onBack?: () => void;
}

export function ProjectDetail({
  project,
  allEquipment,
  canEdit,
  onEdit,
  onUpdate,
  onEquipmentChange,
  getEquipmentProject,
  onBack,
}: Props) {
  const { message, modal } = App.useApp();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const reloadHistory = useCallback(async () => {
    try {
      const entries = await projectHistoryService.getForProject(project.id);
      setProjectHistory(entries);
    } catch {
      // не блокируем UI если история не загрузилась
    } finally {
      setHistoryLoading(false);
    }
  }, [project.id]);

  useEffect(() => { void reloadHistory(); }, [reloadHistory]);

  const projectEquipment = project.equipmentIds
    .map((id) => allEquipment.find((e) => e.id === id))
    .filter((e): e is Equipment => !!e);

  // Выдать всё: проект → Активен, оборудование → В Работе
  const handleActivate = () => {
    modal.confirm({
      title: 'Выдать всё оборудование?',
      content: `Статус всех единиц изменится на «В Работе», локация — «${project.location}»`,
      okText: 'Выдать',
      cancelText: 'Отмена',
      onOk: async () => {
        projectEquipment.forEach((eq) =>
          eq.addHistoryEntry('В Работе', project.location, project.responsible),
        );
        project.status = 'Активен';
        await Promise.all([
          ...projectEquipment.map((eq) =>
            historyService.addEntry(eq.id, 'В Работе', project.location, project.responsible),
          ),
          projectService.update(project),
          projectHistoryService.addEntry(project.id, 'activated'),
        ]);
        onUpdate(project);
        onEquipmentChange();
        void reloadHistory();
        void message.success('Оборудование выдано, проект активен');
      },
    });
  };

  // Завершить проект: всё оборудование → На Складе, проект → Завершён
  const handleFinish = () => {
    modal.confirm({
      title: 'Завершить проект?',
      content: 'Всё оборудование будет возвращено на склад, проект закрыт.',
      okText: 'Завершить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        projectEquipment.forEach((eq) =>
          eq.addHistoryEntry('На Складе', 'Склад', project.responsible),
        );
        project.status = 'Завершён';
        project.equipmentIds = [];
        await Promise.all([
          ...projectEquipment.map((eq) =>
            historyService.addEntry(eq.id, 'На Складе', 'Склад', project.responsible),
          ),
          projectService.update(project),
          projectHistoryService.addEntry(project.id, 'finished'),
        ]);
        onUpdate(project);
        onEquipmentChange();
        void reloadHistory();
        void message.success('Проект завершён, оборудование возвращено на склад');
      },
    });
  };

  // Убрать единицу из проекта
  const handleRemoveEquipment = async (eq: Equipment) => {
    if (eq.currentStatus === 'Забронировано' || eq.currentStatus === 'В Работе') {
      eq.addHistoryEntry('На Складе', 'Склад', project.responsible);
      await historyService.addEntry(eq.id, 'На Складе', 'Склад', project.responsible);
    }
    project.equipmentIds = project.equipmentIds.filter((id) => id !== eq.id);
    await Promise.all([
      projectService.update(project),
      projectHistoryService.addEntry(project.id, 'equipment_removed', {
        equipmentId: eq.id,
        equipmentName: eq.model,
      }),
    ]);
    onUpdate(project);
    onEquipmentChange();
    void reloadHistory();
    void message.success(`${eq.model} убрано из проекта`);
  };

  // Добавить оборудование: подтверждение в пикере
  const handlePickerConfirm = async () => {
    if (pickerSelected.length === 0) {
      setPickerOpen(false);
      return;
    }
    const toAdd = allEquipment.filter((e) => pickerSelected.includes(e.id));
    toAdd.forEach((eq) =>
      eq.addHistoryEntry('Забронировано', eq.currentLocation, project.responsible),
    );
    project.equipmentIds = [...new Set([...project.equipmentIds, ...pickerSelected])];
    await Promise.all([
      ...toAdd.map((eq) =>
        historyService.addEntry(eq.id, 'Забронировано', eq.currentLocation, project.responsible),
      ),
      ...toAdd.map((eq) =>
        projectHistoryService.addEntry(project.id, 'equipment_added', {
          equipmentId: eq.id,
          equipmentName: eq.model,
        }),
      ),
      projectService.update(project),
    ]);
    onUpdate(project);
    onEquipmentChange();
    void reloadHistory();
    setPickerSelected([]);
    setPickerOpen(false);
    void message.success(`Добавлено ${toAdd.length} ед. оборудования`);
  };

  const pickerFiltered = allEquipment.filter((e) => {
    const q = pickerSearch.toLowerCase().trim();
    return !q || e.model.toLowerCase().includes(q) || e.invNumber.toLowerCase().includes(q);
  });

  const equipmentColumns = [
    {
      title: '',
      dataIndex: 'image',
      key: 'image',
      width: 48,
      render: (_: unknown, eq: Equipment) => (
        <Avatar src={eq.image} shape="square" size={36} style={{ borderRadius: 4 }} />
      ),
    },
    {
      title: 'Модель',
      key: 'model',
      render: (_: unknown, eq: Equipment) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{eq.model}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{eq.invNumber}</div>
        </div>
      ),
    },
    {
      title: 'Статус',
      key: 'status',
      width: 145,
      render: (_: unknown, eq: Equipment) => (
        <Tag color={EQUIPMENT_STATUS_COLOR[eq.currentStatus]}>{eq.currentStatus}</Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 48,
      render: (_: unknown, eq: Equipment) =>
        canEdit && project.status !== 'Завершён' ? (
          <Popconfirm
            title="Убрать из проекта?"
            okText="Убрать"
            cancelText="Отмена"
            onConfirm={() => void handleRemoveEquipment(eq)}
          >
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
      {onBack && (
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={onBack}
          style={{ marginBottom: 12, paddingLeft: 0 }}
        >
          Назад
        </Button>
      )}
      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="flex-start" gap={16}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex gap={8} style={{ marginBottom: 8 }} align="center">
              <Tag color={PROJECT_STATUS_COLOR[project.status]}>{project.status}</Tag>
              {project.client && (
                <Text type="secondary" style={{ fontSize: 13 }}>{project.client}</Text>
              )}
            </Flex>
            <Title level={4} style={{ margin: '0 0 4px' }}>
              {project.name}
            </Title>
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="Даты">
                {formatDateRange(project.startDate, project.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Локация">{project.location}</Descriptions.Item>
              <Descriptions.Item label="Ответственный">{project.responsible}</Descriptions.Item>
              {project.notes && (
                <Descriptions.Item label="Заметки" span={2}>
                  {project.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
          <Flex gap={8} wrap style={{ flexShrink: 0 }}>
            {canEdit && project.status !== 'Завершён' && (
              <Button icon={<EditOutlined />} onClick={onEdit}>
                Изменить
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={() => exportCompletion(project, projectEquipment)}
              disabled={projectEquipment.length === 0}
            >
              Экспорт
            </Button>
            {canEdit && project.status === 'Планируется' && projectEquipment.length > 0 && (
              <Button type="primary" icon={<SendOutlined />} onClick={handleActivate}>
                Выдать всё
              </Button>
            )}
            {canEdit && project.status === 'Активен' && (
              <Button danger icon={<CheckOutlined />} onClick={handleFinish}>
                Завершить проект
              </Button>
            )}
          </Flex>
        </Flex>
      </Card>

      {/* Equipment list */}
      <Card
        title={`Комплект оборудования (${projectEquipment.length} ед.)`}
        size="small"
        extra={
          canEdit && project.status !== 'Завершён' && (
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                setPickerSelected([]);
                setPickerSearch('');
                setPickerOpen(true);
              }}
            >
              Добавить
            </Button>
          )
        }
      >
        <Table<Equipment>
          dataSource={projectEquipment}
          rowKey="id"
          columns={equipmentColumns}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Нет оборудования — добавьте из каталога' }}
        />
      </Card>

      {/* Equipment picker modal */}
      <Modal
        title="Добавить оборудование в проект"
        open={pickerOpen}
        onCancel={() => setPickerOpen(false)}
        onOk={() => void handlePickerConfirm()}
        okText={`Добавить${pickerSelected.length > 0 ? ` (${pickerSelected.length})` : ''}`}
        cancelText="Отмена"
        width={560}
      >
        <Input
          placeholder="Поиск по модели или INV-номеру..."
          value={pickerSearch}
          onChange={(e) => setPickerSearch(e.target.value)}
          allowClear
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {pickerFiltered.map((eq) => {
            const occupyingProject = getEquipmentProject(eq.id);
            const alreadyInThis = project.equipmentIds.includes(eq.id);
            const inOtherProject = occupyingProject && occupyingProject.id !== project.id;
            const disabled = alreadyInThis || !!inOtherProject;
            const isSelected = pickerSelected.includes(eq.id);

            const row = (
              <div
                key={eq.id}
                onClick={() => {
                  if (disabled) return;
                  setPickerSelected((prev) =>
                    prev.includes(eq.id) ? prev.filter((id) => id !== eq.id) : [...prev, eq.id],
                  );
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: isSelected ? '#e6f4ff' : disabled ? '#fafafa' : 'transparent',
                  opacity: disabled ? 0.5 : 1,
                  marginBottom: 4,
                  border: `1px solid ${isSelected ? '#1677ff' : '#f0f0f0'}`,
                  transition: 'all 0.15s',
                }}
              >
                <Avatar src={eq.image} shape="square" size={36} style={{ borderRadius: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{eq.model}</Text>
                  <Flex gap={6} align="center">
                    <Text type="secondary" style={{ fontSize: 11 }}>{eq.invNumber}</Text>
                    <Tag
                      color={EQUIPMENT_STATUS_COLOR[eq.currentStatus]}
                      style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}
                    >
                      {eq.currentStatus}
                    </Tag>
                    {alreadyInThis && (
                      <Text type="secondary" style={{ fontSize: 11 }}>уже в проекте</Text>
                    )}
                    {inOtherProject && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        занято: {occupyingProject!.name}
                      </Text>
                    )}
                  </Flex>
                </div>
                {isSelected && <CheckOutlined style={{ color: '#1677ff', flexShrink: 0 }} />}
              </div>
            );

            return inOtherProject ? (
              <Tooltip key={eq.id} title={`Занято проектом: ${occupyingProject!.name}`}>
                {row}
              </Tooltip>
            ) : row;
          })}
        </div>
      </Modal>

      {/* История проекта */}
      <Card title="История проекта" size="small" style={{ marginTop: 16 }}>
        {historyLoading ? (
          <Flex justify="center" style={{ padding: 16 }}><Spin /></Flex>
        ) : projectHistory.length === 0 ? (
          <Text type="secondary">Нет записей</Text>
        ) : (
          <Timeline
            style={{ marginTop: 8 }}
            items={projectHistory.map((entry) => ({
              dot: HISTORY_ICON[entry.action],
              color: HISTORY_COLOR[entry.action],
              children: (
                <div>
                  <Text>
                    <Text strong>{entry.userName ?? 'Система'}</Text>
                    {' '}{HISTORY_LABEL[entry.action]}
                    {entry.equipmentName && (
                      <Text type="secondary"> — {entry.equipmentName}</Text>
                    )}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {entry.recordedAt.toLocaleString('ru-RU')}
                  </Text>
                </div>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
}
