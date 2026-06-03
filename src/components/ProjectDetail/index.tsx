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
  Grid,
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
import { Project, ProjectData, ProjectStatus } from '../../models/Project';
import { Equipment, EquipmentLocation, EquipmentStatus } from '../../models/Equipment';
import { historyService } from '../../services/historyService';
import { projectService } from '../../services/projectService';
import { projectHistoryService, ProjectHistoryEntry } from '../../services/projectHistoryService';
import { loanService, Loan } from '../../services/loanService';

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
  'Выдан': 'volcano',
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
    'Раздел': e.department === 'studio' ? 'Студия' : 'АХО',
    'Инв. номер': e.invNumber,
    'Модель': e.model,
    'Серийный номер': e.serialNumber,
    'Статус': e.currentStatus,
    'Ответственный': e.responsible,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Комплект');
  const endDate = project.endDate.toLocaleDateString('ru-RU');
  XLSX.writeFile(wb, `${project.name} до ${endDate}.xlsx`);
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
  const isMobile = !Grid.useBreakpoint().md;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [pickerDept, setPickerDept] = useState<'studio' | 'aho'>('studio');
  const [activeLoans, setActiveLoans] = useState<Record<string, Loan>>({});
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

  const studioEquipment = projectEquipment.filter((e) => e.department === 'studio');
  const ahoEquipment = projectEquipment.filter((e) => e.department === 'aho' || e.department === 'office');

  const openPicker = async (dept: 'studio' | 'aho') => {
    setPickerSelected([]);
    setPickerSearch('');
    setPickerDept(dept);
    try {
      const loans = await loanService.getAllActiveLoans();
      setActiveLoans(loans);
    } catch { setActiveLoans({}); }
    setPickerOpen(true);
  };

  // Выдать всё: проект → Активен, оборудование → В Работе
  const handleActivate = () => {
    modal.confirm({
      title: 'Выдать всё оборудование?',
      content: `Статус всех единиц изменится на «В Работе», локация — «${project.location}»`,
      okText: 'Выдать',
      cancelText: 'Отмена',
      onOk: async () => {
        const activated = new Project({ ...project, status: 'Активен' } as ProjectData);
        await Promise.all([
          ...projectEquipment.map((eq) =>
            historyService.addEntry(eq.id, 'В Работе', project.location, project.responsible),
          ),
          projectService.update(activated),
          projectHistoryService.addEntry(project.id, 'activated'),
        ]);
        projectEquipment.forEach((eq) =>
          eq.addHistoryEntry('В Работе', project.location as EquipmentLocation, project.responsible),
        );
        project.status = 'Активен';
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
        const finished = new Project({ ...project, status: 'Завершён', equipmentIds: [] } as ProjectData);
        await Promise.all([
          ...projectEquipment.map((eq) =>
            historyService.addEntry(eq.id, 'На Складе', 'Склад', project.responsible),
          ),
          projectService.update(finished),
          projectHistoryService.addEntry(project.id, 'finished'),
        ]);
        projectEquipment.forEach((eq) =>
          eq.addHistoryEntry('На Складе', 'Склад', project.responsible),
        );
        project.status = 'Завершён';
        project.equipmentIds = [];
        onUpdate(project);
        onEquipmentChange();
        void reloadHistory();
        void message.success('Проект завершён, оборудование возвращено на склад');
      },
    });
  };

  // Убрать единицу из проекта
  const handleRemoveEquipment = async (eq: Equipment) => {
    const needsHistory = eq.currentStatus === 'Забронировано' || eq.currentStatus === 'В Работе';
    const newEquipmentIds = project.equipmentIds.filter((id) => id !== eq.id);
    const updated = new Project({ ...project, equipmentIds: newEquipmentIds } as ProjectData);
    if (needsHistory) {
      await historyService.addEntry(eq.id, 'На Складе', 'Склад', project.responsible);
    }
    await Promise.all([
      projectService.update(updated),
      projectHistoryService.addEntry(project.id, 'equipment_removed', {
        equipmentId: eq.id,
        equipmentName: eq.model,
      }),
    ]);
    if (needsHistory) {
      eq.addHistoryEntry('На Складе', 'Склад', project.responsible);
    }
    project.equipmentIds = newEquipmentIds;
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
    // Закрываем активные займы для добавляемого оборудования
    const loansToClose = toAdd
      .map((eq) => activeLoans[eq.id])
      .filter(Boolean) as import('../../services/loanService').Loan[];
    const addStatus: EquipmentStatus = project.status === 'Активен' ? 'В Работе' : 'Забронировано';
    const addLocation = project.status === 'Активен' ? project.location : undefined;
    const newEquipmentIds = [...new Set([...project.equipmentIds, ...pickerSelected])];
    const updated = new Project({ ...project, equipmentIds: newEquipmentIds } as ProjectData);
    await Promise.all([
      ...loansToClose.map((loan) => loanService.returnLoan(loan.id, loan.equipmentId)),
      ...toAdd.map((eq) =>
        historyService.addEntry(eq.id, addStatus, addLocation ?? eq.currentLocation, project.responsible),
      ),
      ...toAdd.map((eq) =>
        projectHistoryService.addEntry(project.id, 'equipment_added', {
          equipmentId: eq.id,
          equipmentName: eq.model,
        }),
      ),
      projectService.update(updated),
    ]);
    toAdd.forEach((eq) =>
      eq.addHistoryEntry(addStatus, (addLocation ?? eq.currentLocation) as EquipmentLocation, project.responsible),
    );
    project.equipmentIds = newEquipmentIds;
    onUpdate(project);
    onEquipmentChange();
    void reloadHistory();
    setPickerSelected([]);
    setPickerOpen(false);
    const closedMsg = loansToClose.length > 0 ? `, займов закрыто: ${loansToClose.length}` : '';
    void message.success(`Добавлено ${toAdd.length} ед. оборудования${closedMsg}`);
  };

  const pickerFiltered = allEquipment.filter((e) => {
    const deptMatch = pickerDept === 'studio'
      ? e.department === 'studio'
      : (e.department === 'aho' || e.department === 'office');
    const q = pickerSearch.toLowerCase().trim();
    return deptMatch && (!q || e.model.toLowerCase().includes(q) || e.invNumber.toLowerCase().includes(q));
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
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 860, margin: '0 auto' }}>
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
        <div>
          <Flex gap={8} style={{ marginBottom: 6 }} align="center" wrap>
            <Tag color={PROJECT_STATUS_COLOR[project.status]}>{project.status}</Tag>
            {project.client && (
              <Text type="secondary" style={{ fontSize: 13 }}>{project.client}</Text>
            )}
          </Flex>
          <Title
            level={isMobile ? 5 : 4}
            style={{ margin: '0 0 8px', wordBreak: 'normal', overflowWrap: 'break-word' }}
          >
            {project.name}
          </Title>
          <Descriptions size="small" column={{ xs: 1, sm: 1, md: 2 }} style={{ marginBottom: 12 }}>
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
          <Flex gap={8} wrap>
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
        </div>
      </Card>

      {/* Студийное оборудование */}
      <Card
        title={`Комплект оборудования (${studioEquipment.length} ед.)`}
        size="small"
        style={{ marginBottom: 12 }}
        extra={
          canEdit && project.status !== 'Завершён' && (
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => void openPicker('studio')}
            >
              Добавить
            </Button>
          )
        }
      >
        <Table<Equipment>
          dataSource={studioEquipment}
          rowKey="id"
          columns={equipmentColumns}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Нет оборудования — добавьте из каталога' }}
        />
      </Card>

      {/* АХО */}
      <Card
        title={`АХО (${ahoEquipment.length} ед.)`}
        size="small"
        extra={
          canEdit && project.status !== 'Завершён' && (
            <Button
              size="small"
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => void openPicker('aho')}
            >
              Добавить
            </Button>
          )
        }
      >
        <Table<Equipment>
          dataSource={ahoEquipment}
          rowKey="id"
          columns={equipmentColumns}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Нет реквизита — добавьте из каталога' }}
        />
      </Card>

      {/* Equipment picker modal */}
      <Modal
        title={pickerDept === 'studio' ? 'Добавить оборудование в комплект' : 'Добавить в АХО'}
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
            const datesOverlap = occupyingProject && occupyingProject.id !== project.id && (() => {
              const s1 = project.startDate, e1 = project.endDate;
              const s2 = occupyingProject.startDate, e2 = occupyingProject.endDate;
              if (!s1 || !e1 || !s2 || !e2) return true;
              return s1 <= e2 && s2 <= e1;
            })();
            const inOtherProject = !!datesOverlap;
            const activeLoan = activeLoans[eq.id];
            // Займ не блокирует — проект важнее. Постоянное назначение блокирует.
            const isAssigned = eq.currentStatus === 'Выдан' && !activeLoan;
            const disabled = alreadyInThis || inOtherProject || isAssigned;
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
                    {inOtherProject && occupyingProject && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        занято: {occupyingProject.name}
                      </Text>
                    )}
                    {isAssigned && (
                      <Text type="secondary" style={{ fontSize: 11 }}>выдано сотруднику</Text>
                    )}
                    {activeLoan && (
                      <Text style={{ fontSize: 11, color: '#1677ff' }}>
                        займ до {activeLoan.dueDate
                          ? activeLoan.dueDate.toLocaleDateString('ru-RU')
                          : 'б/д'} — будет закрыт
                      </Text>
                    )}
                  </Flex>
                </div>
                {isSelected && <CheckOutlined style={{ color: '#1677ff', flexShrink: 0 }} />}
              </div>
            );

            return inOtherProject ? (
              <Tooltip key={eq.id} title={`Конфликт дат: ${occupyingProject!.name} (${occupyingProject!.startDate.toLocaleDateString('ru-RU')} — ${occupyingProject!.endDate.toLocaleDateString('ru-RU')})`}>{row}</Tooltip>
            ) : isAssigned ? (
              <Tooltip key={eq.id} title="Выдано сотруднику. Верните оборудование, чтобы добавить в проект.">{row}</Tooltip>
            ) : activeLoan ? (
              <Tooltip key={eq.id} title="Активный займ будет автоматически закрыт при добавлении в проект.">{row}</Tooltip>
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
