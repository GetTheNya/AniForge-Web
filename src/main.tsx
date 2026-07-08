import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DatabaseProvider } from './context/DatabaseContext';
import { AuthProvider } from './context/AuthContext';
import { UserTrackingProvider } from './context/UserTrackingContext';
import { SettingsProvider } from './context/SettingsContext';
import { NavigationProvider } from './context/NavigationContext';
import { ToastProvider } from './context/ToastContext';
import { RandomSessionProvider } from './context/RandomSessionContext';
import { ContextMenuProvider } from './context/ContextMenuContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DatabaseProvider>
      <AuthProvider>
        <UserTrackingProvider>
          <SettingsProvider>
            <NavigationProvider>
              <ToastProvider>
                <RandomSessionProvider>
                  <ContextMenuProvider>
                    <App />
                  </ContextMenuProvider>
                </RandomSessionProvider>
              </ToastProvider>
            </NavigationProvider>
          </SettingsProvider>
        </UserTrackingProvider>
      </AuthProvider>
    </DatabaseProvider>
  </StrictMode>,
);


