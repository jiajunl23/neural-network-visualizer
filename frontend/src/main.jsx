import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const sceneData = window.__SCENE_DATA__ || null;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App sceneData={sceneData} />
  </React.StrictMode>
);
