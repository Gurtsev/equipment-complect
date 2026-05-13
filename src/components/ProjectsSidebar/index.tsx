import { useState } from 'react';
import { Typography, Tag, Flex, Button, List, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Project, ProjectStatus } from '../../models/Project';

const { Text } = Typography;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  'Планируется': 'blue',
  'Активен': 'green',
  'Завершён': 'default',
};

const STATUS_OPTIONS: Array<{ label: string; value: ProjectStatus | 'all' }> = [
  { label: 'Все', value: 'all' },
  { label: 'Планируется', value: 'Планируется' },
  { label: 'Активен', value: 'Активен' },
  { label: 'Завершён', value: 'Завершён' },
];

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  return `${fmt(start)} — ${fmt(end)}`;
}

interface Props {
  projects: Project[];
  selected: Project | null;
  onSelect: (project: Project) => void;
  onAdd: () => void;
}

export function ProjectsSidebar({ projects, selected, onSelect, onAdd }: Props) {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const filtered = projects.filter(
    (p) => statusFilter === 'all' || p.status === statusFilter,
  );

  return (
    <Flex vertical style={{ height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
          <Text strong style={{ fontSize: 15 }}>
            Проекты
          </Text>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onAdd}>
            Создать
          </Button>
        </Flex>
        <Select
          size="small"
          style={{ width: '100%' }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />
      </div>

      {/* List */}
      <List
        style={{ flex: 1, overflowY: 'auto' }}
        dataSource={filtered}
        locale={{ emptyText: projects.length === 0 ? 'Нет проектов' : 'Ничего не найдено' }}
        renderItem={(project) => {
          const isSelected = selected?.id === project.id;
          return (
            <List.Item
              key={project.id}
              onClick={() => onSelect(project)}
              style={{
                cursor: 'pointer',
                padding: '10px 16px',
                background: isSelected ? '#e6f4ff' : 'transparent',
                borderLeft: `3px solid ${isSelected ? '#1677ff' : 'transparent'}`,
                transition: 'background 0.15s',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
              }}
            >
              <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                <Text strong style={{ fontSize: 13 }}>
                  {project.name}
                </Text>
                <Tag
                  color={STATUS_COLOR[project.status]}
                  style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0, flexShrink: 0 }}
                >
                  {project.status}
                </Tag>
              </Flex>
              {project.client && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {project.client}
                </Text>
              )}
              <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {formatDateRange(project.startDate, project.endDate)}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  🎬 {project.equipmentIds.length} ед.
                </Text>
              </Flex>
            </List.Item>
          );
        }}
      />
    </Flex>
  );
}
