import { useState, useEffect, useCallback } from 'react';
import { Layout, App as AntApp, Spin, Button, Flex, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { CatalogSidebar } from './components/CatalogSidebar';
import { EquipmentDetail } from './components/EquipmentDetail';
import { CreateEquipmentDrawer } from './components/CreateEquipmentDrawer';
import { Dashboard } from './components/Dashboard';
import { ProjectsSidebar } from './components/ProjectsSidebar';
import { ProjectDetail } from './components/ProjectDetail';
import { CreateProjectDrawer } from './components/CreateProjectDrawer';
import { LoginPage } from './components/LoginPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { equipmentService } from './services/equipmentService';
import { historyService } from './services/historyService';
import { projectService } from './services/projectService';
import { Equipment, EquipmentLocation, EquipmentStatus } from './models/Equipment';
import { Project } from './models/Project';

const { Sider, Content } = Layout;
const { Text } = Typography;

type ActiveTab = 'catalog' | 'projects';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор',
  operator: 'Оператор',
  viewer: 'Наблюдатель',
};

const TAB_STYLE_BASE: React.CSSProperties = {
  flex: 1,
  padding: '10px 0',
  textAlign: 'center',
  cursor: 'pointer',
  fontSize: 13,
  userSelect: 'none',
  transition: 'color 0.15s',
};

function AppInner() {
  const { message } = AntApp.useApp();
  const { user, role, userName, loading: authLoading, signOut } = useAuth();

  const [items, setItems] = useState<Equipment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [detailKey, setDetailKey] = useState(0);
  const [equipmentDrawerMode, setEquipmentDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [projectDrawerMode, setProjectDrawerMode] = useState<'create' | 'edit' | null>(null);

  const canEdit = role === 'admin' || role === 'operator';

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
    const timeout = setTimeout(() => {
      setDataLoading(false);
      void message.error('Не удалось загрузить данные. Проверьте соединение или консоль браузера (F12).');
    }, 12000);

    void loadAll()
      .catch(() => {
        void message.error('Ошибка загрузки. Проверьте соединение.');
      })
      .finally(() => {
        clearTimeout(timeout);
        setDataLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [loadAll, user, message]);

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

  if (authLoading || (!!user && dataLoading)) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spin size="large" />
        <Typography.Text type="secondary">Загрузка...</Typography.Text>
      </div>
    );
  }

  if (!user) return <LoginPage />;

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
    />
  ) : selectedEquipment ? (
    <EquipmentDetail
      key={`${selectedEquipment.id}-${detailKey}`}
      equipment={selectedEquipment}
      canEdit={canEdit}
      onEdit={() => setEquipmentDrawerMode('edit')}
      project={getEquipmentProject(selectedEquipment.id) ?? null}
      onProjectClick={handleProjectClick}
      onStatusUpdate={handleStatusUpdate}
    />
  ) : (
    <Dashboard items={items} />
  );

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        width={320}
        theme="light"
        style={{
          borderRight: '1px solid #f0f0f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Вкладки */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          {(['catalog', 'projects'] as ActiveTab[]).map((tab) => {
            const label = tab === 'catalog' ? 'Каталог' : 'Проекты';
            const isActive = activeTab === tab;
            return (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  ...TAB_STYLE_BASE,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#1677ff' : '#595959',
                  borderBottom: `2px solid ${isActive ? '#1677ff' : 'transparent'}`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Контент вкладок */}
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

        {/* Пользователь */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
          <Flex justify="space-between" align="center">
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>
                {userName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {ROLE_LABEL[role ?? ''] ?? role}
              </Text>
            </div>
            <Button
              size="small"
              icon={<LogoutOutlined />}
              onClick={() => void signOut()}
              title="Выйти"
            />
          </Flex>
        </div>
      </Sider>

      <Content style={{ overflow: 'auto', background: '#f5f7fa', height: '100vh' }}>
        {rightPane}
      </Content>

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
    </Layout>
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
