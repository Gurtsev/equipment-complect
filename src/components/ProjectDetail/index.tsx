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
  Select,
  Alert,
  Space,
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
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Project, ProjectData, ProjectStatus } from '../../models/Project';
import { Equipment, EquipmentLocation, EquipmentStatus } from '../../models/Equipment';
import { historyService } from '../../services/historyService';
import { projectService } from '../../services/projectService';
import { getProjectErrorMessage } from '../../services/projectErrors';
import { projectHistoryService, ProjectHistoryEntry } from '../../services/projectHistoryService';
import { loanService, Loan } from '../../services/loanService';
import type { EquipmentList } from '../../services/listService';
import { analyzeProjectListImport } from '../../services/projectListImport';
import { supabase } from '../../services/supabase';

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
  'Комплектуется': 'geekblue',
};

const HISTORY_LABEL: Record<string, string> = {
  equipment_added: 'добавил в комплект',
  equipment_removed: 'убрал из комплекта',
  activated: 'выдал оборудование (проект активен)',
  finished: 'завершил проект',
  created: 'создал проект',
  updated: 'обновил проект',
  list_imported: 'добавил оборудование из списка',
};

const HISTORY_COLOR: Record<string, string> = {
  equipment_added: 'green',
  equipment_removed: 'red',
  activated: 'blue',
  finished: 'gray',
  created: 'blue',
  updated: 'gray',
  list_imported: 'purple',
};

const HISTORY_ICON: Record<string, React.ReactNode> = {
  equipment_added: <PlusCircleOutlined />,
  equipment_removed: <MinusCircleOutlined />,
  activated: <PlayCircleOutlined />,
  finished: <CheckCircleOutlined />,
  created: <PlusCircleOutlined />,
  updated: <EditOutlined />,
  list_imported: <UnorderedListOutlined />,
};

function formatDateRange(start: Date, end: Date): string {
  return `${start.toLocaleDateString('ru-RU')} — ${end.toLocaleDateString('ru-RU')}`;
}

async function exportCompletion(project: Project, equipment: Equipment[]) {
  const rows = equipment.map((e) => ({
    'Инв. номер': e.invNumber,
    'Модель': e.model,
    'Серийный номер': e.serialNumber,
    'Статус': e.currentStatus,
    'Ответственный': e.responsible,
  }));
  const { exportProjectWorkbook } = await import('../../services/excelExport');
  const endDate = project.endDate.toLocaleDateString('ru-RU');
  exportProjectWorkbook(rows, `${project.name} до ${endDate}.xlsx`);
}

interface Props {
  project: Project;
  allEquipment: Equipment[];
  canEdit: boolean;
  onEdit: () => void;
  onUpdate: (project: Project) => void;
  onEquipmentChange: () => void;
  getEquipmentProject: (equipmentId: string) => Project | undefined;
  lists: EquipmentList[];
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
  lists,
  onBack,
}: Props) {
  const { message, modal } = App.useApp();
  const isMobile = !Grid.useBreakpoint().md;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [activeLoans, setActiveLoans] = useState<Record<string, Loan>>({});
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [listImportOpen, setListImportOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>();
  const [listImportLoading, setListImportLoading] = useState(false);
  const [listImportSupported, setListImportSupported] = useState(false);

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

  useEffect(() => {
    const channel = supabase
      .channel(`project-history-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'inventory',
          table: 'project_history',
          filter: `project_id=eq.${project.id}`,
        },
        () => void reloadHistory(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [project.id, reloadHistory]);

  useEffect(() => {
    let cancelled = false;
    void projectHistoryService.supportsListImports().then((supported) => {
      if (!cancelled) setListImportSupported(supported);
    });
    return () => { cancelled = true; };
  }, []);

  const projectEquipment = project.equipmentIds
    .map((id) => allEquipment.find((e) => e.id === id))
    .filter((e): e is Equipment => !!e);

  const openPicker = async () => {
    setPickerSelected([]);
    setPickerSearch('');
    try {
      const loans = await loanService.getAllActiveLoans();
      setActiveLoans(loans);
    } catch { setActiveLoans({}); }
    setPickerOpen(true);
  };

  const loadActiveLoans = async () => {
    try {
      setActiveLoans(await loanService.getAllActiveLoans());
    } catch {
      setActiveLoans({});
    }
  };

  const openListImport = async () => {
    setSelectedListId(undefined);
    await loadActiveLoans();
    setListImportOpen(true);
  };

  const selectedList = lists.find((list) => list.id === selectedListId);

  const getListItemBlockReason = (eq: Equipment): string | null => {
    if (eq.currentStatus === 'Комплектуется') return 'Комплектуется';
    if (eq.currentStatus === 'Списано') return 'Списано';
    if (eq.currentStatus === 'В Ремонте') return 'В ремонте';
    if (eq.currentStatus === 'Выдан' && !activeLoans[eq.id]) return 'Выдано сотруднику';

    const occupyingProject = getEquipmentProject(eq.id);
    if (occupyingProject && occupyingProject.id !== project.id) {
      const overlaps = project.startDate <= occupyingProject.endDate
        && occupyingProject.startDate <= project.endDate;
      if (overlaps) return `Занято проектом «${occupyingProject.name}»`;
    }
    return null;
  };

  const listImportRows = analyzeProjectListImport(
    selectedList?.equipmentIds ?? [],
    project.equipmentIds,
    allEquipment,
    getListItemBlockReason,
  );
  const importableRows = listImportRows.filter((row) => !row.reason && row.equipment);
  const alreadyCount = listImportRows.filter((row) => row.reason === 'Уже в проекте').length;
  const unavailableRows = listImportRows.filter((row) => row.reason && row.reason !== 'Уже в проекте');

  const handleListImport = async () => {
    if (!selectedList || importableRows.length === 0) return;
    setListImportLoading(true);
    try {
      const toAdd = importableRows.map((row) => row.equipment!);
      const loansToClose = toAdd
        .map((eq) => activeLoans[eq.id])
        .filter(Boolean) as Loan[];
      const addStatus: EquipmentStatus = project.status === 'Активен' ? 'В Работе' : 'Забронировано';
      const addLocation = project.status === 'Активен' ? project.location : undefined;
      const newEquipmentIds = [...new Set([...project.equipmentIds, ...toAdd.map((eq) => eq.id)])];
      const updated = new Project({ ...project, equipmentIds: newEquipmentIds } as ProjectData);

      const closedLoanCount = await projectService.addEquipmentAtomic(
        project.id,
        toAdd.map((eq) => eq.id),
        {
          listId: selectedList.id,
          listName: selectedList.name,
          skippedCount: listImportRows.length - toAdd.length,
        },
      );

      if (closedLoanCount === null) {
        // Rolling-deploy fallback until migration 030 is applied.
        await Promise.all(loansToClose.map((loan) => loanService.returnLoan(loan.id, loan.equipmentId)));
        await Promise.all([
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
          projectHistoryService.addEntry(project.id, 'list_imported', {
            listId: selectedList.id,
            listName: selectedList.name,
            importedCount: toAdd.length,
            skippedCount: listImportRows.length - toAdd.length,
          }),
        ]);
      }

      project.equipmentIds = newEquipmentIds;
      onUpdate(project);
      onEquipmentChange();
      void reloadHistory();
      setListImportOpen(false);
      setSelectedListId(undefined);
      void message.success(`Из списка «${selectedList.name}» добавлено ${toAdd.length} поз.`);
    } catch (error) {
      void message.error(getProjectErrorMessage(error, 'Не удалось добавить оборудование из списка'));
    } finally {
      setListImportLoading(false);
    }
  };

  // Выдать всё: проект → Активен, оборудование → В Работе
  const handleActivate = () => {
    modal.confirm({
      title: 'Выдать всё оборудование?',
      content: `Статус всех единиц изменится на «В Работе», локация — «${project.location}»`,
      okText: 'Выдать',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const handled = await projectService.transitionAtomic(project.id, 'Активен');
          if (!handled) {
            const activated = new Project({ ...project, status: 'Активен' } as ProjectData);
            await Promise.all([
              ...projectEquipment.map((eq) =>
                historyService.addEntry(eq.id, 'В Работе', project.location, project.responsible),
              ),
              projectService.update(activated),
              projectHistoryService.addEntry(project.id, 'activated'),
            ]);
          }
          projectEquipment.forEach((eq) =>
            eq.addHistoryEntry('В Работе', project.location as EquipmentLocation, project.responsible),
          );
          project.status = 'Активен';
          onUpdate(project);
          onEquipmentChange();
          void reloadHistory();
          void message.success('Оборудование выдано, проект активен');
        } catch (error) {
          void message.error(getProjectErrorMessage(error, 'Не удалось активировать проект'));
          throw error;
        }
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
        try {
          const handled = await projectService.transitionAtomic(project.id, 'Завершён');
          if (!handled) {
            const finished = new Project({ ...project, status: 'Завершён', equipmentIds: [] } as ProjectData);
            await Promise.all([
              ...projectEquipment.map((eq) =>
                historyService.addEntry(eq.id, 'На Складе', 'Склад', project.responsible),
              ),
              projectService.update(finished),
              projectHistoryService.addEntry(project.id, 'finished'),
            ]);
          }
          projectEquipment.forEach((eq) =>
            eq.addHistoryEntry('На Складе', 'Склад', project.responsible),
          );
          project.status = 'Завершён';
          project.equipmentIds = [];
          onUpdate(project);
          onEquipmentChange();
          void reloadHistory();
          void message.success('Проект завершён, оборудование возвращено на склад');
        } catch (error) {
          void message.error(getProjectErrorMessage(error, 'Не удалось завершить проект'));
          throw error;
        }
      },
    });
  };

  // Убрать единицу из проекта
  const handleRemoveEquipment = async (eq: Equipment) => {
    try {
      const needsHistory = eq.currentStatus === 'Забронировано' || eq.currentStatus === 'В Работе';
      const newEquipmentIds = project.equipmentIds.filter((id) => id !== eq.id);
      const handled = await projectService.removeEquipmentAtomic(project.id, [eq.id]);
      if (!handled) {
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
      }
      if (needsHistory) {
        eq.addHistoryEntry('На Складе', 'Склад', project.responsible);
      }
      project.equipmentIds = newEquipmentIds;
      onUpdate(project);
      onEquipmentChange();
      void reloadHistory();
      void message.success(`${eq.model} убрано из проекта`);
    } catch (error) {
      void message.error(getProjectErrorMessage(error, 'Не удалось убрать оборудование из проекта'));
    }
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
    try {
      const closedLoanCount = await projectService.addEquipmentAtomic(
        project.id,
        toAdd.map((eq) => eq.id),
      );
      if (closedLoanCount === null) {
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
      }
      toAdd.forEach((eq) =>
        eq.addHistoryEntry(
          addStatus,
          (addLocation ?? (closedLoanCount !== null && activeLoans[eq.id] ? 'Склад' : eq.currentLocation)) as EquipmentLocation,
          project.responsible,
        ),
      );
      project.equipmentIds = newEquipmentIds;
      onUpdate(project);
      onEquipmentChange();
      void reloadHistory();
      setPickerSelected([]);
      setPickerOpen(false);
      const actualClosedCount = closedLoanCount ?? loansToClose.length;
      const closedMsg = actualClosedCount > 0 ? `, займов закрыто: ${actualClosedCount}` : '';
      void message.success(`Добавлено ${toAdd.length} ед. оборудования${closedMsg}`);
    } catch (error) {
      void message.error(getProjectErrorMessage(error, 'Не удалось добавить оборудование в проект'));
    }
  };

  const pickerFiltered = allEquipment.filter((e) => {
    if (e.currentStatus === 'Комплектуется') return false;
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
              onClick={() => {
                void exportCompletion(project, projectEquipment)
                  .catch(() => message.error('Не удалось сформировать Excel-файл'));
              }}
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

      {/* Оборудование проекта */}
      <Card
        title={`Комплект оборудования (${projectEquipment.length} ед.)`}
        size="small"
        style={{ marginBottom: 12 }}
        extra={
          canEdit && project.status !== 'Завершён' && (
            <Space size={6}>
              {listImportSupported && (
                <Button
                  size="small"
                  icon={<UnorderedListOutlined />}
                  onClick={() => void openListImport()}
                >
                  Из списка
                </Button>
              )}
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => void openPicker()}
              >
                Добавить
              </Button>
            </Space>
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

      {/* Import equipment from a reusable list template */}
      <Modal
        title="Добавить оборудование из списка"
        open={listImportOpen}
        onCancel={() => setListImportOpen(false)}
        onOk={() => void handleListImport()}
        okText={importableRows.length > 0 ? `Добавить (${importableRows.length})` : 'Добавить'}
        okButtonProps={{ disabled: importableRows.length === 0, loading: listImportLoading }}
        cancelText="Отмена"
        width={620}
      >
        <Select
          value={selectedListId}
          onChange={setSelectedListId}
          placeholder="Выберите список-шаблон"
          style={{ width: '100%', marginBottom: 16 }}
          options={lists
            .filter((list) => !list.isArchived && list.equipmentIds.length > 0)
            .map((list) => ({
              value: list.id,
              label: `${list.name} (${list.equipmentIds.length} поз.)`,
            }))}
        />

        {selectedList && (
          <>
            <Alert
              type={unavailableRows.length > 0 ? 'warning' : 'info'}
              showIcon
              message={`Будет добавлено: ${importableRows.length}; уже в проекте: ${alreadyCount}; недоступно: ${unavailableRows.length}`}
              description="Оборудование, которое уже есть в проекте, останется без изменений. Лишние позиции из проекта не удаляются."
              style={{ marginBottom: 12 }}
            />
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {listImportRows.map(({ equipmentId, equipment, reason }) => (
                <Flex key={equipmentId} justify="space-between" align="center" gap={12} style={{ padding: '7px 4px', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ minWidth: 0 }}>
                    <Text strong>{equipment?.model ?? equipmentId}</Text>
                    {equipment?.invNumber && <Text type="secondary"> · {equipment.invNumber}</Text>}
                  </div>
                  {reason ? <Tag color={reason === 'Уже в проекте' ? 'default' : 'red'}>{reason}</Tag> : <Tag color="green">Будет добавлено</Tag>}
                </Flex>
              ))}
            </div>
          </>
        )}
      </Modal>

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
                    {entry.action === 'list_imported' && (
                      <Text type="secondary">
                        {' '}«{entry.listName ?? 'Удалённый список'}» — добавлено {entry.importedCount ?? 0}, пропущено {entry.skippedCount ?? 0}
                      </Text>
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
