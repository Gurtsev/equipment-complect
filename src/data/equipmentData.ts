import { Equipment } from '../models/Equipment';
import { EquipmentRepository } from '../models/EquipmentRepository';

const d = (y: number, m: number, day: number, h = 10, min = 0) =>
  new Date(y, m - 1, day, h, min);

const seed: Equipment[] = [
  // ── Cameras ────────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-1001',
    model: 'Sony FX6',
    subtitle: 'Full-Frame Cinema Camera',
    category: 'camera',
    description: 'Кинокамера с полнокадровым сенсором, dual ISO до 12800, встроенный ND-фильтр 2–7 стопов.',
    image: '/src/assets/sonyfx6.webp',
    invNumber: 'INV-2023-0001',
    serialNumber: 'SN-SONY-84612037',
    responsible: 'Алексей Смирнов',
    accessories: ['Аккумулятор NP-FZ100 ×2', 'Зарядное BC-QZ1', 'XLR-адаптер XLR-K3M', 'Ремень'],
    history: [
      { date: d(2026, 5, 10, 9, 0), status: 'Забронировано', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2026, 3, 5), status: 'На Складе', location: 'Склад', responsible: 'Алексей Смирнов' },
      { date: d(2025, 9, 12), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-1002',
    model: 'Sony FX3',
    subtitle: 'Full-Frame Cinema Line Camera',
    category: 'camera',
    description: 'Компактная полнокадровая кинокамера с активным стабилизатором и 4K 120fps.',
    image: '',
    invNumber: 'INV-2023-0002',
    serialNumber: 'SN-SONY-71930481',
    responsible: 'Алексей Смирнов',
    accessories: ['Аккумулятор NP-FZ100 ×3', 'Рукоятка GP-VPT2BT', 'CFexpress карта 256GB'],
    history: [
      { date: d(2026, 5, 8, 10, 0), status: 'В Работе', location: 'Студия Медиа Крыша', responsible: 'Алексей Смирнов' },
      { date: d(2026, 4, 20), status: 'На Складе', location: 'Склад', responsible: 'Алексей Смирнов' },
      { date: d(2025, 11, 3), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-1003',
    model: 'Canon EOS R5',
    subtitle: 'Mirrorless Full-Frame',
    category: 'camera',
    description: '8K RAW внутрисистемная запись, двойная карточная система, IBIS 8 стопов.',
    image: '',
    invNumber: 'INV-2024-0001',
    serialNumber: 'SN-CANON-40823761',
    responsible: 'Ольга Новикова',
    accessories: ['Аккумулятор LP-E6NH ×2', 'Зарядное LC-E6', 'CFexpress карта 512GB'],
    history: [
      { date: d(2026, 4, 28, 14, 30), status: 'В Ремонте', location: 'Ремонт', responsible: 'Иван Петров' },
      { date: d(2026, 3, 10), status: 'В Работе', location: 'Студия на Романовом', responsible: 'Ольга Новикова' },
      { date: d(2025, 12, 15), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Microphones ────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-2001',
    model: 'Rode NTG5',
    subtitle: 'Broadcast-grade Shotgun Microphone',
    category: 'microphone',
    description: 'Суперкардиоидный шотган-микрофон с расширенным частотным диапазоном, очень лёгкий (76 г).',
    image: '',
    invNumber: 'INV-2023-0003',
    serialNumber: 'SN-RODE-20318794',
    responsible: 'Михаил Козлов',
    accessories: ['Пистолет Rode PG2-R', 'Ветрозащита Rode DeadCat', 'XLR-кабель 5м'],
    history: [
      { date: d(2026, 2, 1), status: 'На Складе', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2025, 10, 20), status: 'На Складе', location: 'Склад', responsible: 'Алексей Смирнов' },
    ],
  }),

  new Equipment({
    id: 'EQP-2002',
    model: 'Sennheiser MKH 416',
    subtitle: 'Short Shotgun Interference Tube Microphone',
    category: 'microphone',
    description: 'Профессиональный интерференционный микрофон, стандарт индустрии для озвучивания на площадке.',
    image: '',
    invNumber: 'INV-2023-0004',
    serialNumber: 'SN-SENNHEISER-10947382',
    responsible: 'Михаил Козлов',
    accessories: ['Держатель MZS 414', 'Ветрозащита MZH 416', 'Кейс'],
    history: [
      { date: d(2026, 5, 8, 10, 0), status: 'В Работе', location: 'Студия Медиа Крыша', responsible: 'Алексей Смирнов' },
      { date: d(2026, 4, 5), status: 'На Складе', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2025, 8, 7), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Lights ─────────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-3001',
    model: 'Aputure 600D Pro',
    subtitle: 'Daylight LED Monolight',
    category: 'light',
    description: '600 Вт дневного света, Bowen-S mount, Wi-Fi/Bluetooth управление, бесшумный режим.',
    image: '',
    invNumber: 'INV-2023-0005',
    serialNumber: 'SN-APUTURE-60038821',
    responsible: 'Дмитрий Волков',
    accessories: ['Октабокс Aputure 90cm', 'Боуэн-адаптер', 'Транспортный кейс', 'Штатив C-stand'],
    history: [
      { date: d(2026, 1, 15), status: 'На Складе', location: 'Склад', responsible: 'Дмитрий Волков' },
      { date: d(2025, 11, 25), status: 'В Работе', location: 'Студия на Романовом', responsible: 'Дмитрий Волков' },
      { date: d(2025, 7, 10), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-3002',
    model: 'Aputure 120D II',
    subtitle: 'LED COB Light',
    category: 'light',
    description: '120 Вт дневного COB-света с линзой Fresnel в комплекте, мощный и компактный.',
    image: '',
    invNumber: 'INV-2024-0002',
    serialNumber: 'SN-APUTURE-12091043',
    responsible: 'Дмитрий Волков',
    accessories: ['Линза Fresnel', 'Световой стенд', 'Пульт управления'],
    history: [
      { date: d(2026, 5, 10, 9, 0), status: 'Забронировано', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2026, 2, 28), status: 'На Складе', location: 'Склад', responsible: 'Дмитрий Волков' },
      { date: d(2025, 9, 1), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Audio ──────────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-4001',
    model: 'Sound Devices MixPre-6 II',
    subtitle: 'Audio Recorder / Mixer',
    category: 'audio',
    description: '6-канальный полевой рекордер с преампами Kashmir, 32-bit float запись.',
    image: '',
    invNumber: 'INV-2023-0006',
    serialNumber: 'SN-SOUNDDEVICES-60024317',
    responsible: 'Михаил Козлов',
    accessories: ['Аккумуляторный блок MX-LMount', 'SD-карта 128GB ×2', 'Переходник XLR'],
    history: [
      { date: d(2026, 5, 8, 10, 0), status: 'В Работе', location: 'Студия Медиа Крыша', responsible: 'Алексей Смирнов' },
      { date: d(2026, 4, 1), status: 'На Складе', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2025, 10, 14), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-4002',
    model: 'Zoom F6',
    subtitle: 'Field Recorder',
    category: 'audio',
    description: '6-входной рекордер с 32-bit float, двойной AD-конвертацией, компактный корпус.',
    image: '',
    invNumber: 'INV-2024-0003',
    serialNumber: 'SN-ZOOM-60091283',
    responsible: 'Михаил Козлов',
    accessories: ['SD-карта 64GB', 'Аккумуляторы AA ×6', 'Сумка'],
    history: [
      { date: d(2026, 5, 12, 8, 0), status: 'В Пути', location: 'В пути', responsible: 'Дмитрий Волков' },
      { date: d(2026, 5, 1), status: 'На Складе', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2026, 1, 20), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Computers ──────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-5001',
    model: 'Apple MacBook Pro 16"',
    subtitle: 'M3 Pro, 36GB RAM',
    category: 'computer',
    description: 'Рабочая станция для монтажа и цветокоррекции. DaVinci Resolve + Adobe CC.',
    image: '',
    invNumber: 'INV-2024-0004',
    serialNumber: 'SN-APPLE-M3PRO9142',
    responsible: 'Ольга Новикова',
    accessories: ['Зарядное 140W USB-C', 'Кабель Thunderbolt 4', 'Чехол'],
    history: [
      { date: d(2026, 3, 18), status: 'На Складе', location: 'Склад', responsible: 'Ольга Новикова' },
      { date: d(2025, 12, 5), status: 'В Работе', location: 'Студия Медиа Крыша', responsible: 'Ольга Новикова' },
      { date: d(2025, 10, 1), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Accessories ────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-6001',
    model: 'DJI Ronin RS3 Pro',
    subtitle: 'Gimbal Stabilizer',
    category: 'accessory',
    description: 'Трёхосевой стабилизатор до 4,5 кг, Bluetooth-джойстик в комплекте, LiDAR AF.',
    image: '',
    invNumber: 'INV-2024-0005',
    serialNumber: 'SN-DJI-RS3P7840123',
    responsible: 'Алексей Смирнов',
    accessories: ['Аккумулятор ×2', 'Bluetooth-джойстик', 'Кейс', 'Фокус-мотор'],
    history: [
      { date: d(2026, 5, 10, 9, 0), status: 'Забронировано', location: 'Склад', responsible: 'Михаил Козлов' },
      { date: d(2026, 4, 10), status: 'На Складе', location: 'Склад', responsible: 'Алексей Смирнов' },
      { date: d(2026, 2, 3), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-6002',
    model: 'Manfrotto 504X + 645 FAST Carbon',
    subtitle: 'Video Tripod System',
    category: 'accessory',
    description: 'Профессиональная видеоголовка с карбоновыми ногами. Была повреждена при транспортировке.',
    image: '',
    invNumber: 'INV-2023-0007',
    serialNumber: 'SN-MANFROTTO-504X9921',
    responsible: 'Иван Петров',
    accessories: [],
    history: [
      { date: d(2026, 1, 8, 16, 0), status: 'Списано', location: 'Склад', responsible: 'Иван Петров' },
      { date: d(2025, 12, 20), status: 'В Ремонте', location: 'Ремонт', responsible: 'Иван Петров' },
      { date: d(2025, 6, 1), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  // ── Optics ─────────────────────────────────────────────────────────────────
  new Equipment({
    id: 'EQP-7001',
    model: 'Sigma 24-70mm f/2.8 DG DN Art',
    subtitle: 'Standard Zoom Lens (Sony E)',
    category: 'optics',
    description: 'Зум-объектив Art-серии для беззеркальных камер Sony E, оптический стабилизатор.',
    image: '',
    invNumber: 'INV-2023-0008',
    serialNumber: 'SN-SIGMA-2470ART3821',
    responsible: 'Ольга Новикова',
    accessories: ['Крышка объектива', 'Защитный фильтр 82mm', 'Бленда LH880-03'],
    history: [
      { date: d(2026, 4, 30), status: 'На Складе', location: 'Склад', responsible: 'Ольга Новикова' },
      { date: d(2025, 9, 17), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),

  new Equipment({
    id: 'EQP-7002',
    model: 'Sony FE 85mm f/1.4 GM',
    subtitle: 'Portrait Prime Lens',
    category: 'optics',
    description: 'Портретный объектив серии G Master, исключительная резкость и боке, Nano AR coating.',
    image: '',
    invNumber: 'INV-2024-0006',
    serialNumber: 'SN-SONY-85GM48271',
    responsible: 'Алексей Смирнов',
    accessories: ['Крышка объектива', 'Защитный фильтр 77mm', 'Бленда ALC-SH152'],
    history: [
      { date: d(2026, 5, 8, 10, 0), status: 'В Работе', location: 'Студия Медиа Крыша', responsible: 'Алексей Смирнов' },
      { date: d(2026, 3, 25), status: 'На Складе', location: 'Склад', responsible: 'Алексей Смирнов' },
      { date: d(2025, 11, 11), status: 'На Складе', location: 'Склад', responsible: 'Иван Петров' },
    ],
  }),
];

export const repository = new EquipmentRepository(seed);
