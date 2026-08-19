import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import './global.css';
import './print.css';
import App from './App';
import inventoryLogo from '../megapolis-platform/brand/logos/inventory.svg';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = inventoryLogo;
document.head.append(favicon);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
