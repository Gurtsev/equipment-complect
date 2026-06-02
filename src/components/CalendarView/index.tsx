import { useState } from 'react';
import { Calendar, Badge, Card, Tag, Typography, Flex, Empty, Divider, Button } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { Project } from '../../models/Project';
import { Equipment } from '../../models/Equipment';

dayjs.locale('ru');

const { Text, Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  'Планируется': 'blue',
  'Активен': 'green',
  'Завершён': 'default',
};

interface Props {
  projects: Project[];
  allEquipment: Equipment[];
  onProjectSelect: (project: Project) => void;
}

export function CalendarView({ projects: source, allEquipment, onProjectSelect }: Props) {
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [onlyActive, setOnlyActive] = useState(false);
  const getProjectsForDate = (source: Project[], date: Dayjs): Project[] => {
    const d = date.startOf('day');
    return source.filter(p => {
      if (p.status === 'Завершён') return false;
      const start = dayjs(p.startDate).startOf('day');
      const end = dayjs(p.endDate).startOf('day');
      return !d.isBefore(start) && !d.isAfter(end);
    });
  };

  
  const activeCount = source.filter(p => p.status === 'Активен').length;
  const visibleProjects = onlyActive ? source.filter(p => p.status === 'Активен') : source;
  const selectedProjects = getProjectsForDate(visibleProjects, selectedDate);
  const bookedIds = new Set(selectedProjects.flatMap(p => p.equipmentIds));
  const bookedCount = allEquipment.filter(e => bookedIds.has(e.id)).length;
  const freeCount = allEquipment.length - bookedCount;
  
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>Календарь занятости</Title>
      <Text type="secondary" style={{display: 'block', marginBottom: 16 }}>Активных проектов: {activeCount}</Text>
      <Button type="primary" onClick={() => setOnlyActive(!onlyActive)}>
        {onlyActive ? 'Показать все' : 'Показать только активные'}
      </Button>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Calendar
          fullscreen={false}
          cellRender={(date, info) => {
            if (info.type !== 'date') return info.originNode;
            const dayProjects = getProjectsForDate(visibleProjects, date);
            if (dayProjects.length === 0) return null;
            return (
              <Flex gap={2} wrap="wrap" style={{ marginTop: 2 }}>
                {dayProjects.map(p => (
                  <Badge
                    key={p.id}
                    color={p.status === 'Активен' ? '#52c41a' : '#1677ff'}
                  />
                ))}
              </Flex>
            );
          }}
          onSelect={(date, info) => {
            if (info.source === 'date') setSelectedDate(date);
          }}
        />
      </Card>

      <Card
        title={selectedDate.format('D MMMM YYYY')}
        size="small"
      >
        {selectedProjects.length === 0 ? (
          <Empty description="Нет активных проектов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            <Flex gap={8} wrap="wrap" style={{ marginBottom: 12 }}>
              <Tag color="orange">Занято: {bookedCount} ед.</Tag>
              <Tag color="green">Свободно: {freeCount} ед.</Tag>
            </Flex>
            <Divider style={{ margin: '8px 0' }} />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Проекты в этот день:
            </Text>
            <Flex vertical gap={4}>
              {selectedProjects.map(p => (
                <div
                  key={p.id}
                  onClick={() => onProjectSelect(p)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f5f7fa'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Flex gap={8} align="center">
                    <Tag color={STATUS_COLOR[p.status]} style={{ margin: 0 }}>
                      {p.status}
                    </Tag>
                    <Text style={{ fontSize: 13, flex: 1 }}>{p.name}</Text>
                    <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                      {p.equipmentIds.length} ед.
                    </Text>
                  </Flex>
                </div>
              ))}
            </Flex>
          </>
        )}
      </Card>
    </div>
  );
}
