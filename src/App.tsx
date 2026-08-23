import { lazy, Suspense, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Layout, App as AntApp, Spin, Button, Typography, Grid, Form, Input, Badge, Drawer, ConfigProvider } from 'antd';
import { LogoutOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import inventoryLogo from './assets/inventory.svg';
import { supabase } from './services/supabase';
import { equipmentService } from './services/equipmentService';
import { historyService } from './services/historyService';
import { projectService } from './services/projectService';
import { getProjectErrorMessage } from './services/projectErrors';
import { consumablesService } from './services/consumablesService';
import { roomService } from './services/roomService';
import type { Room } from './services/roomService';
import { cartService } from './services/cartService';
import type { CartItem } from './services/cartService';
import { listService } from './services/listService';
import type { EquipmentList } from './services/listService';
import { AssemblyStatus, Equipment, EquipmentLocation, EquipmentStatus } from './models/Equipment';
import { Project } from './models/Project';
import type { Consumable } from './services/consumablesService';
import { parseInventoryDeepLink } from './services/deepLink';

const CatalogSidebar = lazy(() => import('./components/CatalogSidebar').then((module) => ({ default: module.CatalogSidebar })));
const CatalogGrid = lazy(() => import('./components/CatalogGrid').then((module) => ({ default: module.CatalogGrid })));
const EquipmentDetail = lazy(() => import('./components/EquipmentDetail').then((module) => ({ default: module.EquipmentDetail })));
const CreateEquipmentDrawer = lazy(() => import('./components/CreateEquipmentDrawer').then((module) => ({ default: module.CreateEquipmentDrawer })));
const Dashboard = lazy(() => import('./components/Dashboard').then((module) => ({ default: module.Dashboard })));
const ProjectsSidebar = lazy(() => import('./components/ProjectsSidebar').then((module) => ({ default: module.ProjectsSidebar })));
const ProjectDetail = lazy(() => import('./components/ProjectDetail').then((module) => ({ default: module.ProjectDetail })));
const CreateProjectDrawer = lazy(() => import('./components/CreateProjectDrawer').then((module) => ({ default: module.CreateProjectDrawer })));
const UsersPage = lazy(() => import('./components/UsersPage').then((module) => ({ default: module.UsersPage })));
const CalendarView = lazy(() => import('./components/CalendarView').then((module) => ({ default: module.CalendarView })));
const ConsumablesPage = lazy(() => import('./components/ConsumablesPage').then((module) => ({ default: module.ConsumablesPage })));
const RoomsPage = lazy(() => import('./components/RoomsPage').then((module) => ({ default: module.RoomsPage })));
const CartDrawer = lazy(() => import('./components/CartDrawer').then((module) => ({ default: module.CartDrawer })));
const ListsPage = lazy(() => import('./components/ListsPage').then((module) => ({ default: module.ListsPage })));
const InventoryPage = lazy(() => import('./components/InventoryPage').then((module) => ({ default: module.InventoryPage })));

const { Sider, Content } = Layout;
const { Text } = Typography;

const contentFallback = (
  <div style={{ width: '100%', height: '100%', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin />
  </div>
);

type ActiveTab = 'catalog' | 'projects' | 'users' | 'calendar' | 'consumables' | 'rooms' | 'lists' | 'inventory';

const NEXUS_LOGIN_URL = 'https://nexus.knzteam.ru/login';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Наблюдатель',
};

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup${compact ? ' brand-lockup--compact' : ''}`}>
      <img className="brand-lockup__icon" src={inventoryLogo} alt="" aria-hidden="true" />
      <div className="brand-lockup__copy">
        <span className="brand-lockup__product">Inventory</span>
        <span className="brand-lockup__company">Megapolis</span>
      </div>
    </div>
  );
}

function BrandState({ children }: { children: ReactNode }) {
  return (
    <main className="brand-state">
      <BrandLockup />
      <div className="brand-state__content">{children}</div>
    </main>
  );
}


function AppInner() {
  const { message } = AntApp.useApp();
  const { user, role, userName, loading: authLoading, isRecovery, recoveryError, updatePassword, signOut } = useAuth();

  const [items, setItems] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [detailKey, setDetailKey] = useState(0);
  const [equipmentDrawerMode, setEquipmentDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Equipment | null>(null);
  const [projectDrawerMode, setProjectDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [catalogFilteredItems, setCatalogFilteredItems] = useState<Equipment[] | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [lists, setLists] = useState<EquipmentList[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const canEdit = role === 'admin' || role === 'operator';
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const loadAll = useCallback(async () => {
    const [newItems, newProjects, newConsumables, newRooms] = await Promise.all([
      equipmentService.getAll(),
      projectService.getAll(),
      consumablesService.getAll(),
      roomService.getAll(),
    ]);
    setItems(newItems);
    setProjects(newProjects);
    setConsumables(newConsumables);
    setRooms(newRooms);
    // Корзина и списки загружаются отдельно — их ошибка не блокирует основной UI
    void Promise.all([cartService.getItems(), listService.getAll()])
      .then(([newCartItems, newLists]) => {
        setCartItems(newCartItems);
        setLists(newLists);
      })
      .catch(() => { /* cart/lists недоступны — UI работает без них */ });
    return { newItems, newProjects, newRooms };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    const timeout = setTimeout(() => {
      setDataLoading(false);
      setLoadError(true);
    }, 35000);

    void loadAll()
      .then(({ newItems, newRooms }) => {
        const deepLink = parseInventoryDeepLink(window.location.search);
        if (deepLink.target?.type === 'equipment') {
          const found = newItems.find((e) => e.id === deepLink.target?.value);
          if (found) {
            setSelectedEquipment(found);
            setActiveTab('catalog');
          }
        } else if (deepLink.target?.type === 'room') {
          const found = newRooms.find((r) => r.code === deepLink.target?.value);
          if (found) {
            setSelectedRoom(found);
            setActiveTab('rooms');
          }
        }
        if (deepLink.hadInventoryParams) {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + deepLink.remainingSearch,
          );
        }
      })
      .catch(() => { setLoadError(true); })
      .finally(() => {
        clearTimeout(timeout);
        setDataLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [loadAll, user, message]);

  const reloadInProgress = useRef(false);

  const realtimeReload = useCallback(async () => {
    if (reloadInProgress.current) return;
    reloadInProgress.current = true;
    try {
      const { newItems, newProjects } = await loadAll();
      setSelectedEquipment(prev => prev ? (newItems.find(e => e.id === prev.id) ?? null) : null);
      setSelectedProject(prev => prev ? (newProjects.find(p => p.id === prev.id) ?? null) : null);
    } finally {
      reloadInProgress.current = false;
    }
  }, [loadAll]);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void realtimeReload(), 300);
    };
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'equipment' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'equipment_history' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'projects' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'project_equipment' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'employee_assignments' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'consumables' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'consumable_transactions' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'equipment_loans' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'cart_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'equipment_lists' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'equipment_list_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'inventory', table: 'rooms' }, reload)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, realtimeReload]);

  // --- Equipment handlers ---

  const handleEquipmentCreated = async (equipment: Equipment) => {
    try {
      await equipmentService.add(equipment);
      const { newItems } = await loadAll();
      setSelectedEquipment(newItems.find((e) => e.id === equipment.id) ?? null);
      setSelectedProject(null);
    } catch {
      void message.error('Ошибка при сохранении оборудования');
    }
  };

  const handleEquipmentUpdated = async (equipment: Equipment) => {
    try {
      await equipmentService.update(equipment);
      const { newItems } = await loadAll();
      setSelectedEquipment(newItems.find((e) => e.id === equipment.id) ?? null);
    } catch {
      void message.error('Ошибка при обновлении оборудования');
    }
  };

  const handleStatusUpdate = async (
    status: EquipmentStatus,
    location: EquipmentLocation,
    responsible: string,
  ) => {
    if (!selectedEquipment) return;
    try {
      const equipmentId = selectedEquipment.id;
      await historyService.addEntry(equipmentId, status, location, responsible);
      const newItems = await equipmentService.getAll();
      setItems(newItems);
      setSelectedEquipment(newItems.find((item) => item.id === equipmentId) ?? null);
    } catch {
      void message.error('Ошибка при обновлении статуса');
    }
  };

  const handleEquipmentChange = async () => {
    try {
      const { newItems, newProjects } = await loadAll();
      setDetailKey((k) => k + 1);
      if (selectedEquipment) {
        setSelectedEquipment(newItems.find((e) => e.id === selectedEquipment.id) ?? null);
      }
      if (selectedProject) {
        setSelectedProject(newProjects.find((p) => p.id === selectedProject.id) ?? null);
      }
    } catch {
      void message.error('Ошибка при обновлении данных');
    }
  };

  const handleEquipmentDelete = async (eq?: Equipment) => {
    const target = eq ?? selectedEquipment;
    if (!target) return;
    await equipmentService.remove(target.id);
    await loadAll();
    if (!eq || selectedEquipment?.id === target.id) setSelectedEquipment(null);
  };

  const handleEquipmentDuplicate = (eq?: Equipment) => {
    const target = eq ?? selectedEquipment;
    if (!target) return;
    setDuplicateSource(target);
    setEquipmentDrawerMode('create');
  };

  const handleComponentClick = (eq: Equipment) => {
    setSelectedEquipment(eq);
  };

  const handleDetach = async (eq: Equipment) => {
    const updated = new Equipment({ ...eq, parentId: null });
    await equipmentService.update(updated);
    await handleEquipmentChange();
  };

  const handleAssemblyStatusChange = async (eq: Equipment, status: AssemblyStatus) => {
    await equipmentService.setAssemblyStatus(eq.id, status);
    await handleEquipmentChange();
  };

  // --- Project handlers ---

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedEquipment(null);
  };

  const handleProjectCreated = async (project: Project) => {
    try {
      await projectService.add(project);
      const { newProjects } = await loadAll();
      setSelectedProject(newProjects.find((p) => p.id === project.id) ?? null);
      setSelectedEquipment(null);
    } catch (error) {
      void message.error(getProjectErrorMessage(error, 'Ошибка при создании проекта'));
    }
  };

  const handleProjectUpdated = async (project: Project) => {
    try {
      await projectService.update(project);
      const { newProjects } = await loadAll();
      setSelectedProject(newProjects.find((p) => p.id === project.id) ?? null);
    } catch (error) {
      void message.error(getProjectErrorMessage(error, 'Ошибка при обновлении проекта'));
    }
  };

  const handleProjectUpdate = async (project: Project) => {
    try {
      const { newProjects } = await loadAll();
      setSelectedProject(newProjects.find((p) => p.id === project.id) ?? null);
    } catch {
      void message.error('Ошибка при обновлении данных');
    }
  };

  const handleProjectDelete = async () => {
    if (!selectedProject) return;
    await projectService.remove(selectedProject.id);
    await loadAll();
    setSelectedProject(null);
    setProjectDrawerMode(null);
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setSelectedEquipment(null);
    setActiveTab('projects');
  };

  const handleAddToCart = async (equipmentId: string) => {
    const eq = items.find((i) => i.id === equipmentId);
    if (eq?.currentStatus === 'Комплектуется') {
      void message.warning('Оборудование в сборке — нельзя добавить в корзину');
      return;
    }
    try {
      await cartService.addItem(equipmentId);
      const newCartItems = await cartService.getItems();
      setCartItems(newCartItems);
      void message.success('Добавлено в корзину');
    } catch (e) {
      console.error('cart add error', e);
      void message.error('Ошибка при добавлении в корзину');
    }
  };

  const handleCartChanged = async () => {
    const newCartItems = await cartService.getItems();
    setCartItems(newCartItems);
  };

  const handleListsChanged = async () => {
    const newLists = await listService.getAll();
    setLists(newLists);
  };

  const handleRoomsChanged = async () => {
    const newRooms = await roomService.getAll();
    setRooms(newRooms);
    if (selectedRoom) {
      setSelectedRoom(newRooms.find((r) => r.id === selectedRoom.id) ?? null);
    }
  };

  const getEquipmentProject = (equipmentId: string) =>
    projects
      .filter(
        (p) =>
          p.equipmentIds.includes(equipmentId) &&
          (p.status === 'Планируется' || p.status === 'Активен'),
      )
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

  const getEquipmentProjects = (equipmentId: string) =>
    projects.filter(
      (p) =>
        p.equipmentIds.includes(equipmentId) &&
        (p.status === 'Планируется' || p.status === 'Активен'),
    );

  if (authLoading) {
    return (
      <BrandState>
        <Spin size="large" />
        <Typography.Text type="secondary">Загрузка...</Typography.Text>
      </BrandState>
    );
  }

  if (!user && !isRecovery && !recoveryError) {
    // Без хеша: в нём могут быть access_token/refresh_token от Nexus SSO,
    // и при подстановке в query param redirect URL превышает лимит nginx (414).
    const redirect = encodeURIComponent(
      window.location.origin + window.location.pathname + window.location.search,
    );
    window.location.replace(`${NEXUS_LOGIN_URL}?redirect=${redirect}`);
    return (
      <BrandState>
        <Spin size="large" />
        <Typography.Text type="secondary">Перенаправление на вход...</Typography.Text>
      </BrandState>
    );
  }

  if (!user && recoveryError) {
    return (
      <BrandState>
        <Typography.Text type="warning">{recoveryError}</Typography.Text>
        <Button type="primary" href={NEXUS_LOGIN_URL}>
          Перейти на страницу входа
        </Button>
      </BrandState>
    );
  }

  if (isRecovery) {
    return (
      <div className="brand-state brand-state--form">
        <div className="brand-state__panel">
          <BrandLockup compact />
          <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 20, textAlign: 'center' }}>
            Новый пароль
          </Typography.Title>
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={async (values: { password: string }) => {
              const error = await updatePassword(values.password);
              if (error) void message.error(error);
            }}
          >
            <Form.Item
              name="password"
              label="Новый пароль"
              rules={[
                { required: true, message: 'Введите пароль' },
                { min: 6, message: 'Минимум 6 символов' },
              ]}
            >
              <Input.Password placeholder="••••••••" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label="Повторите пароль"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Повторите пароль' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject('Пароли не совпадают');
                  },
                }),
              ]}
            >
              <Input.Password placeholder="••••••••" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Сохранить пароль
            </Button>
          </Form>
        </div>
      </div>
    );
  }

  if (!!user && dataLoading) {
    return (
      <BrandState>
        <Spin size="large" />
        <Typography.Text type="secondary">Загрузка...</Typography.Text>
      </BrandState>
    );
  }

  if (user && !role) {
    return (
      <BrandState>
        <Typography.Title level={4} style={{ margin: 0 }}>Доступ запрещён</Typography.Title>
        <Typography.Text type="secondary">
          Ваш email не входит в список разрешённых. Обратитесь к администратору.
        </Typography.Text>
        <Button onClick={() => signOut()}>Выйти</Button>
      </BrandState>
    );
  }

  if (loadError && items.length === 0) {
    return (
      <BrandState>
        <Typography.Text type="secondary">Не удалось загрузить данные</Typography.Text>
        <Button
          type="primary"
          onClick={() => {
            setDataLoading(true);
            setLoadError(false);
            void loadAll()
              .catch(() => setLoadError(true))
              .finally(() => setDataLoading(false));
          }}
        >
          Повторить
        </Button>
      </BrandState>
    );
  }

  const handleBack = () => {
    setSelectedEquipment(null);
    setSelectedProject(null);
  };

  const rightPane = <Suspense fallback={contentFallback}>{selectedProject ? (
    <ProjectDetail
      key={selectedProject.id}
      project={selectedProject}
      allEquipment={items}
      canEdit={canEdit}
      onEdit={() => setProjectDrawerMode('edit')}
      onDelete={handleProjectDelete}
      onUpdate={handleProjectUpdate}
      onEquipmentChange={handleEquipmentChange}
      getEquipmentProject={getEquipmentProject}
      lists={lists}
      onBack={isMobile ? handleBack : undefined}
    />
  ) : selectedEquipment ? (
    <EquipmentDetail
      key={`${selectedEquipment.id}-${detailKey}`}
      equipment={selectedEquipment}
      canEdit={canEdit}
      isAdmin={role === 'admin'}
      onEdit={() => setEquipmentDrawerMode('edit')}
      onDelete={handleEquipmentDelete}
      onDuplicate={handleEquipmentDuplicate}
      project={getEquipmentProject(selectedEquipment.id) ?? null}
      equipmentProjects={getEquipmentProjects(selectedEquipment.id)}
      onProjectClick={handleProjectClick}
      onStatusUpdate={handleStatusUpdate}
      onBack={isMobile ? handleBack : undefined}
      rooms={rooms}
      allEquipment={items}
      onComponentClick={handleComponentClick}
      onDetach={() => handleDetach(selectedEquipment)}
      onAssemblyStatusChange={(status) => handleAssemblyStatusChange(selectedEquipment, status)}
    />
  ) : isMobile ? null : (
    <Dashboard items={items} />
  )}</Suspense>;

  const criticalCount = consumables.filter(
    (c) => c.minThreshold > 0 && c.quantity < c.minThreshold,
  ).length;

  const tabs: { key: ActiveTab; label: React.ReactNode; tabKey: ActiveTab }[] = [
    { key: 'catalog', tabKey: 'catalog', label: 'Каталог' },
    { key: 'projects', tabKey: 'projects', label: 'Проекты' },
    { key: 'rooms', tabKey: 'rooms', label: 'Помещения' },
    { key: 'calendar', tabKey: 'calendar', label: 'Календарь' },
    ...(canEdit ? [{
      key: 'consumables' as ActiveTab,
      tabKey: 'consumables' as ActiveTab,
      label: (
        <Badge count={criticalCount} size="small" offset={[6, -2]}>
          Расходники
        </Badge>
      ),
    }] : []),
    ...(canEdit ? [{ key: 'lists' as ActiveTab, tabKey: 'lists' as ActiveTab, label: 'Списки' }] : []),
    ...(canEdit ? [{ key: 'inventory' as ActiveTab, tabKey: 'inventory' as ActiveTab, label: 'Инвентаризация' }] : []),
    ...(role === 'admin' ? [{ key: 'users' as ActiveTab, tabKey: 'users' as ActiveTab, label: 'Пользователи' }] : []),
  ];

  const calendarProps = {
    projects,
    allEquipment: items,
    onProjectSelect: (p: Project) => {
      setSelectedProject(p);
      setSelectedEquipment(null);
      setActiveTab('projects');
    },
  };

  const tabContent = <Suspense fallback={contentFallback}>
    <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      {activeTab === 'catalog' ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CatalogSidebar
          items={items}
          selected={null}
          canEdit={canEdit}
          onSelect={() => {}}
          onAdd={() => setEquipmentDrawerMode('create')}
          onAddToCart={canEdit ? handleAddToCart : undefined}
          onFilteredItemsChange={setCatalogFilteredItems}
          rooms={rooms}
        />
      </div> : <div style={{ height: '100%' }}>
        <ProjectsSidebar
          projects={projects}
          selected={selectedProject}
          canEdit={canEdit}
          onSelect={handleProjectSelect}
          onAdd={() => setProjectDrawerMode('create')}
        />
      </div>}
    </div>
  </Suspense>;

  const drawers = <Suspense fallback={null}>
    <>
      {equipmentDrawerMode !== null && <CreateEquipmentDrawer
        open={equipmentDrawerMode !== null}
        onClose={() => { setEquipmentDrawerMode(null); setDuplicateSource(null); }}
        onCreated={handleEquipmentCreated}
        initialEquipment={equipmentDrawerMode === 'edit' ? (selectedEquipment ?? undefined) : undefined}
        onUpdated={handleEquipmentUpdated}
        duplicateSource={equipmentDrawerMode === 'create' ? (duplicateSource ?? undefined) : undefined}
        rooms={rooms}
        allEquipment={items}
      />}
      {projectDrawerMode !== null && <CreateProjectDrawer
        open={projectDrawerMode !== null}
        onClose={() => setProjectDrawerMode(null)}
        onCreated={handleProjectCreated}
        initialProject={projectDrawerMode === 'edit' ? (selectedProject ?? undefined) : undefined}
        onUpdated={handleProjectUpdated}
      />}
      {cartOpen && <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        allEquipment={items}
        lists={lists}
        onCartChanged={handleCartChanged}
        onListsChanged={handleListsChanged}
      />}
      {dashboardOpen && <Drawer
        title="Обзор инвентаря"
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
        width={480}
        styles={{ body: { padding: 0 } }}
      >
        <Dashboard items={items} />
      </Drawer>}
    </>
  </Suspense>;

  const showSider = activeTab === 'catalog' || activeTab === 'projects';

  // ── Header (desktop + mobile) ──────────────────────────────────────
  const navTabs = (scrollable?: boolean) => (
    <nav className="brand-nav" style={{ overflowX: scrollable ? 'auto' : 'visible' }} aria-label="Основные разделы">
      {tabs.map(({ tabKey, label }) => {
        const isActive = activeTab === tabKey;
        return (
          <button
            type="button"
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`brand-nav__item${isActive ? ' brand-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );

  const header = (
    <header className="brand-header">
      <button type="button" className="brand-header__home" onClick={() => setDashboardOpen(true)} aria-label="Открыть обзор инвентаря">
        <BrandLockup />
      </button>
      <div className="brand-header__nav no-scrollbar">
        {navTabs()}
      </div>
      <div className="brand-header__account">
        {canEdit && (
          <Badge count={cartItems.length} size="small">
            <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => setCartOpen(true)} title="Корзина" />
          </Badge>
        )}
        <div style={{ minWidth: 0, textAlign: 'right' }}>
          <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis>{userName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{ROLE_LABEL[role ?? ''] ?? role}</Text>
        </div>
        <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()} title="Выйти" />
      </div>
    </header>
  );

  // ── Mobile ──────────────────────────────────────────────────────────
  if (isMobile) {
    const showDetail = !!selectedEquipment || !!selectedProject;
    return (
      <div className="app-shell app-shell--mobile">
        {/* Compact header on mobile */}
        <div className="brand-mobile-header">
          <button type="button" className="brand-mobile-header__home" onClick={() => setDashboardOpen(true)} aria-label="Открыть обзор инвентаря"><BrandLockup compact /></button>
          <Text type="secondary" style={{ fontSize: 11 }}>{ROLE_LABEL[role ?? ''] ?? role}</Text>
          {canEdit && (
            <Badge count={cartItems.length} size="small">
              <Button size="small" icon={<ShoppingCartOutlined />} onClick={() => setCartOpen(true)} />
            </Badge>
          )}
          <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()} />
        </div>
        {!showDetail && (
          <div className="brand-mobile-nav no-scrollbar">
            {navTabs(true)}
          </div>
        )}
        <Suspense fallback={contentFallback}>{showDetail ? (
          <div className="brand-content">{rightPane}</div>
        ) : activeTab === 'users' ? (
          <div className="brand-content"><UsersPage canEdit={canEdit} allEquipment={items} onEquipmentChanged={handleEquipmentChange} /></div>
        ) : activeTab === 'calendar' ? (
          <div className="brand-content"><CalendarView {...calendarProps} /></div>
        ) : activeTab === 'consumables' ? (
          <div className="brand-content"><ConsumablesPage consumables={consumables} canEdit={canEdit} onChanged={() => void loadAll()} /></div>
        ) : activeTab === 'rooms' ? (
          <div className="brand-content brand-content--fixed"><RoomsPage rooms={rooms} allEquipment={items} canEdit={canEdit} selectedRoom={selectedRoom} onRoomSelect={setSelectedRoom} onRoomsChanged={handleRoomsChanged} /></div>
        ) : activeTab === 'lists' ? (
          <div className="brand-content"><ListsPage lists={lists} allEquipment={items} canEdit={canEdit} onListsChanged={handleListsChanged} /></div>
        ) : activeTab === 'inventory' ? (
          <div className="brand-content brand-content--fixed"><InventoryPage rooms={rooms} equipment={items} canEdit={canEdit} /></div>
        ) : activeTab === 'catalog' ? (
          <div className="brand-content brand-content--fixed">
            <CatalogGrid
              items={catalogFilteredItems ?? items}
              canEdit={canEdit}
              onAdd={() => setEquipmentDrawerMode('create')}
              onEdit={(eq) => { setSelectedEquipment(eq); setEquipmentDrawerMode('edit'); }}
              onAddToCart={canEdit ? handleAddToCart : undefined}
              isAdmin={role === 'admin'}
              onDelete={handleEquipmentDelete}
              onDuplicate={handleEquipmentDuplicate}
              rooms={rooms}
              projects={projects}
              getEquipmentProject={(id) => getEquipmentProject(id) ?? undefined}
              getEquipmentProjects={getEquipmentProjects}
              onProjectClick={handleProjectClick}
              onEquipmentChange={handleEquipmentChange}
              detailKey={detailKey}
              allEquipment={items}
              onDetach={handleDetach}
              onAssemblyStatusChange={handleAssemblyStatusChange}
            />
          </div>
        ) : tabContent}</Suspense>
        {drawers}
      </div>
    );
  }

  // ── Desktop ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {header}
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {showSider && (
          <Sider
            width={320}
            theme="light"
            className="brand-sider"
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {tabContent}
          </Sider>
        )}
        <Content className="brand-content" style={{ height: '100%' }}>
          <Suspense fallback={contentFallback}>
          {activeTab === 'users' ? <UsersPage canEdit={canEdit} allEquipment={items} onEquipmentChanged={handleEquipmentChange} /> :
           activeTab === 'calendar' ? <CalendarView {...calendarProps} /> :
           activeTab === 'consumables' ? <ConsumablesPage consumables={consumables} canEdit={canEdit} onChanged={() => void loadAll()} /> :
           activeTab === 'rooms' ? <RoomsPage rooms={rooms} allEquipment={items} canEdit={canEdit} selectedRoom={selectedRoom} onRoomSelect={setSelectedRoom} onRoomsChanged={handleRoomsChanged} /> :
           activeTab === 'lists' ? <ListsPage lists={lists} allEquipment={items} canEdit={canEdit} onListsChanged={handleListsChanged} /> :
           activeTab === 'inventory' ? <InventoryPage rooms={rooms} equipment={items} canEdit={canEdit} /> :
           activeTab === 'catalog' ? (
             <CatalogGrid
               items={catalogFilteredItems ?? items}
               canEdit={canEdit}
               showControls={false}
               onAdd={() => setEquipmentDrawerMode('create')}
               onEdit={(eq) => { setSelectedEquipment(eq); setEquipmentDrawerMode('edit'); }}
               onAddToCart={canEdit ? handleAddToCart : undefined}
               isAdmin={role === 'admin'}
               onDelete={handleEquipmentDelete}
               onDuplicate={handleEquipmentDuplicate}
               rooms={rooms}
               projects={projects}
               getEquipmentProject={(id) => getEquipmentProject(id) ?? undefined}
               getEquipmentProjects={getEquipmentProjects}
               onProjectClick={handleProjectClick}
               onEquipmentChange={handleEquipmentChange}
               detailKey={detailKey}
               allEquipment={items}
               onDetach={handleDetach}
               onAssemblyStatusChange={handleAssemblyStatusChange}
             />
           ) :
           rightPane}
          </Suspense>
        </Content>
      </Layout>
      {drawers}
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#017038',
          colorInfo: '#017038',
          colorSuccess: '#019247',
          colorLink: '#017038',
          colorText: '#1A1A2E',
          colorTextSecondary: '#69736D',
          colorBorder: '#D9E2DC',
          colorBorderSecondary: '#E8EEEA',
          colorBgLayout: '#F3F7F4',
          colorBgContainer: '#FFFFFF',
          borderRadius: 10,
          borderRadiusLG: 16,
          controlHeight: 38,
          fontFamily: 'Steppe, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          boxShadowSecondary: '0 18px 50px rgba(22, 49, 34, 0.12)',
        },
        components: {
          Button: { primaryShadow: '0 8px 20px rgba(1, 112, 56, 0.18)' },
          Card: { headerBg: '#FFFFFF' },
          Layout: { bodyBg: '#F3F7F4', siderBg: '#FFFFFF', headerBg: '#FFFFFF' },
          Table: { headerBg: '#F5F8F6', headerColor: '#3F4B45', rowHoverBg: '#F4FAF6' },
          Tabs: { itemSelectedColor: '#017038', inkBarColor: '#017038' },
        },
      }}
    >
      <AuthProvider>
        <AntApp>
          <AppInner />
        </AntApp>
      </AuthProvider>
    </ConfigProvider>
  );
}
