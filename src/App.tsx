import { useState } from 'react';
import { Layout, Typography, App as AntApp } from 'antd';
import { CatalogSidebar } from './components/CatalogSidebar';
import { EquipmentDetail } from './components/EquipmentDetail';
import { CreateEquipmentDrawer } from './components/CreateEquipmentDrawer';
import { repository } from './data/equipmentData';
import { Equipment } from './models/Equipment';

const { Sider, Content } = Layout;
const { Text } = Typography;

function AppInner() {
  const [items, setItems] = useState<Equipment[]>(() => repository.getAll());
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCreated = (equipment: Equipment) => {
    repository.add(equipment);
    setItems([...repository.getAll()]);
    setSelected(equipment);
  };

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
        <CatalogSidebar
          items={items}
          selected={selected}
          onSelect={setSelected}
          onAdd={() => setDrawerOpen(true)}
        />
      </Sider>

      <Content style={{ overflow: 'auto', background: '#f5f7fa', height: '100vh' }}>
        {selected ? (
          <EquipmentDetail key={selected.id} equipment={selected} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 48 }}>📋</span>
            <Text type="secondary" style={{ fontSize: 16 }}>
              Выберите оборудование из каталога
            </Text>
          </div>
        )}
      </Content>

      <CreateEquipmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleCreated}
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
