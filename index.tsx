
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OBRProvider } from './obr';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <OBRProvider>
      <App />
    </OBRProvider>
  </React.StrictMode>
);