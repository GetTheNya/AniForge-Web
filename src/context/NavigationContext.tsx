import { createContext, useState, useEffect, type ReactNode } from 'react';

interface LocationState {
  pathname: string;
  search: string;
}

interface NavigationContextType extends LocationState {
  navigate: (pathname: string, search?: string, options?: { replace?: boolean }) => void;
}

export const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationState>({
    pathname: window.location.pathname,
    search: window.location.search,
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentLocation({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (pathname: string, search: string = '', options?: { replace?: boolean }) => {
    if (options?.replace) {
      window.history.replaceState(null, '', pathname + search);
    } else {
      window.history.pushState(null, '', pathname + search);
    }
    setCurrentLocation({ pathname, search });
  };

  return (
    <NavigationContext.Provider value={{ ...currentLocation, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
};
