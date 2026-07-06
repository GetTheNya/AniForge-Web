import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DatabaseProvider>
  </StrictMode>,
);
