import { useState, useEffect, useCallback } from 'react';
import { Layout, App as AntApp, Spin, Button, Typography, Grid, Form, Input } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { CatalogSidebar } from './components/CatalogSidebar';
import { EquipmentDetail } from './components/EquipmentDetail';
import { CreateEquipmentDrawer } from './components/CreateEquipmentDrawer';
import { Dashboard } from './components/Dashboard';
import { ProjectsSidebar } from './components/ProjectsSidebar';
import { ProjectDetail } from './components/ProjectDetail';
import { CreateProjectDrawer } from './components/CreateProjectDrawer';
import { LoginPage } from './components/LoginPage';
import { UsersPage } from './components/UsersPage';
import { CalendarView } from './components/CalendarView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { equipmentService } from './services/equipmentService';
import { historyService } from './services/historyService';
import { projectService } from './services/projectService';
import { Equipment, EquipmentLocation, EquipmentStatus } from './models/Equipment';
import { Project } from './models/Project';

const { Sider, Content } = Layout;
const { Text } = Typography;

type ActiveTab = 'catalog' | 'projects' | 'users' | 'calendar';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Наблюдатель',
};


function AppInner() {
  const { message } = AntApp.useApp();
  const { user, role, userName, userDepartment, loading: authLoading, isRecovery, updatePassword, signOut } = useAuth();

  const [items, setItems] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [detailKey, setDetailKey] = useState(0);
  const [equipmentDrawerMode, setEquipmentDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [projectDrawerMode, setProjectDrawerMode] = useState<'create' | 'edit' | null>(null);

  const canEdit = role === 'admin' || role === 'operator';
  // canEditEquipment: учитывает ограничение по отделу для операторов
  const canEditEquipment = (dept: string) =>
    canEdit && (userDepartment === null || userDepartment === dept);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const loadAll = useCallback(async () => {
    const [newItems, newProjects] = await Promise.all([
      equipmentService.getAll(),
      projectService.getAll(),
    ]);
    setItems(newItems);
    setProjects(newProjects);
    return { newItems, newProjects };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadError(false);
    const timeout = setTimeout(() => {
      setDataLoading(false);
      setLoadError(true);
    }, 35000);

    void loadAll()
      .then(({ newItems }) => {
        const params = new URLSearchParams(window.location.search);
        const eqId = params.get('eq');
        if (eqId) {
          const found = newItems.find((e) => e.id === eqId);
          if (found) {
            setSelectedEquipment(found);
            setActiveTab('catalog');
          }
          window.history.replaceState(null, '', window.location.pathname);
        }
      })
      .catch(() => { setLoadError(true); })
      .finally(() => {
        clearTimeout(timeout);
        setDataLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [loadAll, user, message]);

  const realtimeReload = useCallback(async () => {
    const { newItems, newProjects } = await loadAll();
    setSelectedEquipment(prev => prev ? (newItems.find(e => e.id === prev.id) ?? null) : null);
    setSelectedProject(prev => prev ? (newProjects.find(p => p.id === prev.id) ?? null) : null);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_history' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_equipment' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_assignments' }, reload)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [user, realtimeReload]);

  // --- Equipment handlers ---

  const handleEquipmentSelect = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setSelectedProject(null);
  };

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
      await historyService.addEntry(selectedEquipment.id, status, location, responsible);
      const newItems = await equipmentService.getAll();
      setItems(newItems);
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
    } catch {
      void message.error('Ошибка при создании проекта');
    }
  };

  const handleProjectUpdated = async (project: Project) => {
    try {
      await projectService.update(project);
      const { newProjects } = await loadAll();
      setSelectedProject(newProjects.find((p) => p.id === project.id) ?? null);
    } catch {
      void message.error('Ошибка при обновлении проекта');
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

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setSelectedEquipment(null);
    setActiveTab('projects');
  };

  const getEquipmentProject = (equipmentId: string) =>
    projects.find(
      (p) =>
        p.equipmentIds.includes(equipmentId) &&
        (p.status === 'Планируется' || p.status === 'Активен'),
    );

  if (authLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spin size="large" />
        <Typography.Text type="secondary">Загрузка...</Typography.Text>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (isRecovery) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
        <div style={{ width: 360, background: '#fff', borderRadius: 8, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
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
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spin size="large" />
        <Typography.Text type="secondary">Загрузка...</Typography.Text>
      </div>
    );
  }

  if (user && !role) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Доступ запрещён</Typography.Title>
        <Typography.Text type="secondary">
          Ваш email не входит в список разрешённых. Обратитесь к администратору.
        </Typography.Text>
        <Button onClick={() => signOut()}>Выйти</Button>
      </div>
    );
  }

  if (loadError && items.length === 0) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
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
      </div>
    );
  }

  const handleBack = () => {
    setSelectedEquipment(null);
    setSelectedProject(null);
  };

  const rightPane = selectedProject ? (
    <ProjectDetail
      key={selectedProject.id}
      project={selectedProject}
      allEquipment={items}
      canEdit={canEdit}
      onEdit={() => setProjectDrawerMode('edit')}
      onUpdate={handleProjectUpdate}
      onEquipmentChange={handleEquipmentChange}
      getEquipmentProject={getEquipmentProject}
      onBack={isMobile ? handleBack : undefined}
    />
  ) : selectedEquipment ? (
    <EquipmentDetail
      key={`${selectedEquipment.id}-${detailKey}`}
      equipment={selectedEquipment}
      canEdit={canEditEquipment(selectedEquipment.department)}
      onEdit={() => setEquipmentDrawerMode('edit')}
      project={getEquipmentProject(selectedEquipment.id) ?? null}
      onProjectClick={handleProjectClick}
      onStatusUpdate={handleStatusUpdate}
      onBack={isMobile ? handleBack : undefined}
    />
  ) : isMobile ? null : (
    <Dashboard items={items} />
  );

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'catalog', label: 'Каталог' },
    { key: 'projects', label: 'Проекты' },
    { key: 'calendar', label: 'Календарь' },
    ...(role === 'admin' ? [{ key: 'users' as ActiveTab, label: 'Пользователи' }] : []),
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

  const tabContent = (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div style={{ height: '100%', display: activeTab === 'catalog' ? 'block' : 'none' }}>
        <CatalogSidebar
          items={items}
          selected={selectedEquipment}
          canEdit={canEdit}
          onSelect={handleEquipmentSelect}
          onAdd={() => setEquipmentDrawerMode('create')}
        />
      </div>
      <div style={{ height: '100%', display: activeTab === 'projects' ? 'block' : 'none' }}>
        <ProjectsSidebar
          projects={projects}
          selected={selectedProject}
          canEdit={canEdit}
          onSelect={handleProjectSelect}
          onAdd={() => setProjectDrawerMode('create')}
        />
      </div>
    </div>
  );

  const drawers = (
    <>
      <CreateEquipmentDrawer
        open={equipmentDrawerMode !== null}
        onClose={() => setEquipmentDrawerMode(null)}
        onCreated={handleEquipmentCreated}
        initialEquipment={equipmentDrawerMode === 'edit' ? (selectedEquipment ?? undefined) : undefined}
        onUpdated={handleEquipmentUpdated}
      />
      <CreateProjectDrawer
        open={projectDrawerMode !== null}
        onClose={() => setProjectDrawerMode(null)}
        onCreated={handleProjectCreated}
        initialProject={projectDrawerMode === 'edit' ? (selectedProject ?? undefined) : undefined}
        onUpdated={handleProjectUpdated}
      />
    </>
  );

  const showSider = activeTab === 'catalog' || activeTab === 'projects';

  // ── Header (desktop + mobile) ──────────────────────────────────────
  const navTabs = (scrollable?: boolean) => (
    <div style={{
      display: 'flex',
      overflowX: scrollable ? 'auto' : 'visible',
      flexShrink: 0,
    }}>
      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <div
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '0 16px',
              height: 48,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? '#1677ff' : '#595959',
              borderBottom: `2px solid ${isActive ? '#1677ff' : 'transparent'}`,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              transition: 'color 0.15s',
              flexShrink: 0,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );

  const header = (
    <div style={{
      height: 48,
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderRight: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>Инвентарь студии</Text>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {navTabs()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0, borderLeft: '1px solid #f0f0f0' }}>
        <div style={{ minWidth: 0, textAlign: 'right' }}>
          <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis>{userName}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{ROLE_LABEL[role ?? ''] ?? role}</Text>
        </div>
        <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()} title="Выйти" />
      </div>
    </div>
  );

  // ── Mobile ──────────────────────────────────────────────────────────
  if (isMobile) {
    const showDetail = !!selectedEquipment || !!selectedProject;
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
        {/* Compact header on mobile */}
        <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, gap: 8 }}>
          <Text strong style={{ flex: 1, fontSize: 14 }}>Инвентарь студии</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{ROLE_LABEL[role ?? ''] ?? role}</Text>
          <Button size="small" icon={<LogoutOutlined />} onClick={() => void signOut()} />
        </div>
        {!showDetail && (
          <div style={{ borderBottom: '1px solid #f0f0f0', overflowX: 'auto', flexShrink: 0 }}>
            {navTabs(true)}
          </div>
        )}
        {showDetail ? (
          <div style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}>{rightPane}</div>
        ) : activeTab === 'users' ? (
          <div style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}><UsersPage canEdit={canEdit} allEquipment={items} onEquipmentChanged={handleEquipmentChange} /></div>
        ) : activeTab === 'calendar' ? (
          <div style={{ flex: 1, overflow: 'auto', background: '#f5f7fa' }}><CalendarView {...calendarProps} /></div>
        ) : tabContent}
        {drawers}
      </div>
    );
  }

  // ── Desktop ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {header}
      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {showSider && (
          <Sider
            width={320}
            theme="light"
            style={{ borderRight: '1px solid #f0f0f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            {tabContent}
          </Sider>
        )}
        <Content style={{ overflow: 'auto', background: '#f5f7fa', height: '100%' }}>
          {activeTab === 'users' ? <UsersPage canEdit={canEdit} allEquipment={items} onEquipmentChanged={handleEquipmentChange} /> :
           activeTab === 'calendar' ? <CalendarView {...calendarProps} /> :
           rightPane}
        </Content>
      </Layout>
      {drawers}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AntApp>
        <AppInner />
      </AntApp>
    </AuthProvider>
  );
}
