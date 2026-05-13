import { useState } from 'react';
import { Layout, App as AntApp } from 'antd';
import { CatalogSidebar } from './components/CatalogSidebar';
import { EquipmentDetail } from './components/EquipmentDetail';
import { CreateEquipmentDrawer } from './components/CreateEquipmentDrawer';
import { Dashboard } from './components/Dashboard';
import { ProjectsSidebar } from './components/ProjectsSidebar';
import { ProjectDetail } from './components/ProjectDetail';
import { CreateProjectDrawer } from './components/CreateProjectDrawer';
import { repository } from './data/equipmentData';
import { projectRepository } from './data/projectData';
import { Equipment } from './models/Equipment';
import { Project } from './models/Project';

const { Sider, Content } = Layout;

type ActiveTab = 'catalog' | 'projects';

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
  const [items, setItems] = useState<Equipment[]>(() => repository.getAll());
  const [projects, setProjects] = useState<Project[]>(() => projectRepository.getAll());
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  // detailKey: принудительный ремаунт EquipmentDetail после внешних изменений статуса
  const [detailKey, setDetailKey] = useState(0);
  const [equipmentDrawerMode, setEquipmentDrawerMode] = useState<'create' | 'edit' | null>(null);
  const [projectDrawerMode, setProjectDrawerMode] = useState<'create' | 'edit' | null>(null);

  // --- Equipment handlers ---

  const handleEquipmentSelect = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setSelectedProject(null);
  };

  const handleEquipmentCreated = (equipment: Equipment) => {
    repository.add(equipment);
    setItems([...repository.getAll()]);
    setSelectedEquipment(equipment);
    setSelectedProject(null);
  };

  const handleEquipmentUpdated = (equipment: Equipment) => {
    repository.replace(equipment.id, equipment);
    setItems([...repository.getAll()]);
    setSelectedEquipment(equipment);
  };

  // Вызывается когда проект меняет статус оборудования извне
  const handleEquipmentChange = () => {
    setItems([...repository.getAll()]);
    setDetailKey((k) => k + 1);
  };

  // --- Project handlers ---

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedEquipment(null);
  };

  const handleProjectCreated = (project: Project) => {
    projectRepository.add(project);
    setProjects([...projectRepository.getAll()]);
    setSelectedProject(project);
    setSelectedEquipment(null);
  };

  const handleProjectUpdated = (project: Project) => {
    projectRepository.replace(project.id, project);
    setProjects([...projectRepository.getAll()]);
    setSelectedProject(project);
  };

  const handleProjectUpdate = (project: Project) => {
    projectRepository.replace(project.id, project);
    setProjects([...projectRepository.getAll()]);
    setSelectedProject(project);
  };

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setSelectedEquipment(null);
    setActiveTab('projects');
  };

  const getEquipmentProject = (equipmentId: string) =>
    projectRepository.getByEquipmentId(equipmentId);

  // Правая панель
  const rightPane = selectedProject ? (
    <ProjectDetail
      key={selectedProject.id}
      project={selectedProject}
      allEquipment={items}
      onEdit={() => setProjectDrawerMode('edit')}
      onUpdate={handleProjectUpdate}
      onEquipmentChange={handleEquipmentChange}
      getEquipmentProject={getEquipmentProject}
    />
  ) : selectedEquipment ? (
    <EquipmentDetail
      key={`${selectedEquipment.id}-${detailKey}`}
      equipment={selectedEquipment}
      onEdit={() => setEquipmentDrawerMode('edit')}
      project={getEquipmentProject(selectedEquipment.id) ?? null}
      onProjectClick={handleProjectClick}
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
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}
        >
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
          <div
            style={{
              height: '100%',
              display: activeTab === 'catalog' ? 'block' : 'none',
            }}
          >
            <CatalogSidebar
              items={items}
              selected={selectedEquipment}
              onSelect={handleEquipmentSelect}
              onAdd={() => setEquipmentDrawerMode('create')}
            />
          </div>
          <div
            style={{
              height: '100%',
              display: activeTab === 'projects' ? 'block' : 'none',
            }}
          >
            <ProjectsSidebar
              projects={projects}
              selected={selectedProject}
              onSelect={handleProjectSelect}
              onAdd={() => setProjectDrawerMode('create')}
            />
          </div>
        </div>
      </Sider>

      <Content style={{ overflow: 'auto', background: '#f5f7fa', height: '100vh' }}>
        {rightPane}
      </Content>

      <CreateEquipmentDrawer
        open={equipmentDrawerMode !== null}
        onClose={() => setEquipmentDrawerMode(null)}
        onCreated={handleEquipmentCreated}
        initialEquipment={
          equipmentDrawerMode === 'edit' ? (selectedEquipment ?? undefined) : undefined
        }
        onUpdated={handleEquipmentUpdated}
      />

      <CreateProjectDrawer
        open={projectDrawerMode !== null}
        onClose={() => setProjectDrawerMode(null)}
        onCreated={handleProjectCreated}
        initialProject={
          projectDrawerMode === 'edit' ? (selectedProject ?? undefined) : undefined
        }
        onUpdated={handleProjectUpdated}
      />
    </Layout>
  );
}

export default function App() {
  return (
    <AntApp>
      <AppInner />
    </AntApp>
  );
}
