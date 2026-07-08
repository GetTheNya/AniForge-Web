import { createContext, useState, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface Position {
  x: number;
  y: number;
}

interface ContextMenuContextType {
  isOpen: boolean;
  isExiting: boolean;
  position: Position;
  animeId: number | null;
  animeData: any;
  openContextMenu: (position: Position, animeId: number, animeData: any) => void;
  closeContextMenu: () => void;
  closeContextMenuWithDelay: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [animeId, setAnimeId] = useState<number | null>(null);
  const [animeData, setAnimeData] = useState<any>(null);

  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearExitTimer = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  const openContextMenu = useCallback((pos: Position, id: number, data: any) => {
    clearExitTimer();
    setIsExiting(false);
    setPosition(pos);
    setAnimeId(id);
    setAnimeData(data);
    setIsOpen(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    clearExitTimer();
    setIsExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsExiting(false);
      exitTimerRef.current = null;
    }, 120); // Duration matches CSS exit animation (120ms)
  }, []);

  const closeContextMenuWithDelay = useCallback(() => {
    setTimeout(() => {
      closeContextMenu();
    }, 80); // Micro-delay interaction feedback (80ms)
  }, [closeContextMenu]);

  // Clean up exit timer on unmount
  useEffect(() => {
    return () => clearExitTimer();
  }, []);

  // Global event listeners when the menu is open and not exiting
  useEffect(() => {
    if (!isOpen || isExiting) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (e.button === 0) { // left-click only
        const menuElement = document.getElementById('custom-context-menu');
        if (menuElement && !menuElement.contains(e.target as Node)) {
          closeContextMenu();
        }
      }
    };

    const handleScroll = () => {
      closeContextMenu();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    // Defer attaching listeners slightly to prevent catching the trigger click event
    const timer = setTimeout(() => {
      window.addEventListener('click', handleOutsideClick);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isExiting, closeContextMenu]);

  return (
    <ContextMenuContext.Provider
      value={{
        isOpen,
        isExiting,
        position,
        animeId,
        animeData,
        openContextMenu,
        closeContextMenu,
        closeContextMenuWithDelay,
      }}
    >
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
}
