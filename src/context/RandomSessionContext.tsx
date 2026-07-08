import { createContext, useState, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { useNavigation } from '../hooks/useNavigation';
import { useToast } from './ToastContext';

interface RandomSession {
  collectionId: string | null;
  filteredIds: number[];
  seenIds: number[];
}

interface RandomSessionContextType {
  session: RandomSession | null;
  startRandomSession: (collectionId: string | null, filteredIds: number[]) => void;
  nextRandom: () => number | null;
  clearRandomSession: () => void;
}

const RandomSessionContext = createContext<RandomSessionContextType | null>(null);

export const useRandomSession = () => {
  const context = useContext(RandomSessionContext);
  if (!context) {
    throw new Error('useRandomSession must be used within a RandomSessionProvider');
  }
  return context;
};

export const RandomSessionProvider = ({ children }: { children: ReactNode }) => {
  const { navigate } = useNavigation();
  const { addToast } = useToast();

  const [session, setSession] = useState<RandomSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('aniforge_random_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('[RandomSessionProvider] Failed to load session:', e);
    }
    return null;
  });

  // Sync state to sessionStorage
  useEffect(() => {
    if (session) {
      sessionStorage.setItem('aniforge_random_session', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('aniforge_random_session');
    }
  }, [session]);

  const startRandomSession = useCallback((collectionId: string | null, filteredIds: number[]) => {
    if (filteredIds.length === 0) return;

    // Pick first random item
    const randomIndex = Math.floor(Math.random() * filteredIds.length);
    const firstId = filteredIds[randomIndex];

    const newSession = {
      collectionId,
      filteredIds,
      seenIds: [firstId],
    };

    setSession(newSession);
    navigate('/anime', `?id=${firstId}${collectionId ? `&collectionId=${collectionId}` : ''}`);
  }, [navigate]);

  const nextRandom = useCallback(() => {
    if (!session) return null;

    const { filteredIds, seenIds } = session;
    const unseen = filteredIds.filter((id) => !seenIds.includes(id));

    if (unseen.length === 0) {
      // Finished all items
      addToast('Random anime has ended!', 'info', 4000);
      setSession(null);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * unseen.length);
    const nextId = unseen[randomIndex];

    const updatedSession = {
      ...session,
      seenIds: [...seenIds, nextId],
    };

    setSession(updatedSession);
    navigate('/anime', `?id=${nextId}${session.collectionId ? `&collectionId=${session.collectionId}` : ''}`);
    return nextId;
  }, [session, addToast, navigate]);

  const clearRandomSession = useCallback(() => {
    setSession(null);
  }, []);

  return (
    <RandomSessionContext.Provider
      value={{
        session,
        startRandomSession,
        nextRandom,
        clearRandomSession,
      }}
    >
      {children}
    </RandomSessionContext.Provider>
  );
};
