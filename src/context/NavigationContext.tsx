import { createContext, useState, useEffect, type ReactNode } from 'react';

interface LocationState {
  pathname: string;
  search: string;
}

interface NavigationContextType extends LocationState {
  navigate: (pathname: string, search?: string) => void;
}

// Function to restore the original URL after a 404 redirect
const resolveInitialRoute = (): LocationState => {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectedPath = urlParams.get('_p');
  const redirectedQuery = urlParams.get('_q');

  if (redirectedPath !== null) {
    const cleanPath = '/' + redirectedPath;
    const cleanSearch = redirectedQuery ? '?' + redirectedQuery : '';
    
    // Clean up the browser URL atomically: instead of `?_p=anime&_q=id%3D123`, create a clean `/anime?id=123`.
    window.history.replaceState(null, '', cleanPath + cleanSearch + window.location.hash);
    
    return { pathname: cleanPath, search: cleanSearch };
  }

  // If the site is accessed normally, we return the current default path.
  return { pathname: window.location.pathname, search: window.location.search };
};

export const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider = ({ children }: { children: ReactNode }) => {
  // We load the router state with the data already unpacked.
  const [currentLocation, setCurrentLocation] = useState<LocationState>(resolveInitialRoute());

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

  const navigate = (pathname: string, search: string = '') => {
    window.history.pushState(null, '', pathname + search);
    setCurrentLocation({ pathname, search });
  };

  return (
    <NavigationContext.Provider value={{ ...currentLocation, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
};
