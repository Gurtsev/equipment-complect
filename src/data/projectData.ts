import { Project } from '../models/Project';
import { ProjectRepository } from '../models/ProjectRepository';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const seed: Project[] = [
  new Project({
    id: 'PRJ-0001',
    name: 'Рекламный ролик Ozon',
    client: 'Ozon',
    startDate: d(2026, 5, 5),
    endDate: d(2026, 5, 20),
    location: 'Студия Медиа Крыша',
    responsible: 'Алексей Смирнов',
    status: 'Активен',
    // FX3, MKH 416, MixPre-6 II, Sony 85mm GM — все В Работе
    equipmentIds: ['EQP-1002', 'EQP-2002', 'EQP-4001', 'EQP-7002'],
    notes: 'Два съёмочных дня. Продукт: электроника. Режиссёр: Смирнов А.',
  }),

  new Project({
    id: 'PRJ-0002',
    name: 'Корпоратив РЖД 2026',
    client: 'РЖД',
    startDate: d(2026, 5, 20),
    endDate: d(2026, 5, 22),
    location: 'Студия на Романовом',
    responsible: 'Михаил Козлов',
    status: 'Планируется',
    // FX6, Aputure 120D II, DJI Ronin RS3 Pro — все Забронировано
    equipmentIds: ['EQP-1001', 'EQP-3002', 'EQP-6001'],
    notes: 'Корпоративное мероприятие, живая съёмка + документалка. Нужен дополнительный оператор.',
  }),

  new Project({
    id: 'PRJ-0003',
    name: 'Имиджевая съёмка Nike',
    client: 'Nike Russia',
    startDate: d(2026, 4, 1),
    endDate: d(2026, 4, 10),
    location: 'Студия Медиа Крыша',
    responsible: 'Ольга Новикова',
    status: 'Завершён',
    equipmentIds: [],
    notes: 'Завершён в срок. Итоговый материал передан клиенту 11 апреля.',
  }),
];

export const projectRepository = new ProjectRepository(seed);
