import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider } from './context/AuthContext';
import { UserTrackingProvider } from './context/UserTrackingContext';
import { NavigationProvider } from './context/NavigationContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <AuthProvider>
        <UserTrackingProvider>
          <NavigationProvider>
            <App />
          </NavigationProvider>
        </UserTrackingProvider>
      </AuthProvider>
    </DatabaseProvider>
  </StrictMode>,
);
