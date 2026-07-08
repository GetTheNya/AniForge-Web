import { createContext, useState, useContext, useCallback, useEffect, type ReactNode } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem = ({ toast, onRemove }: { toast: ToastMessage; onRemove: () => void }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    const timer = setTimeout(() => {
      onRemove();
    }, 250); // Matches the CSS exit animation duration (250ms)
    return () => clearTimeout(timer);
  }, [onRemove]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  const typeIcon = {
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
  }[toast.type || 'info'];

  return (
    <div
      onClick={handleDismiss}
      className={`glass-card p-4 rounded-xl border border-[var(--color-border-glass)] bg-[var(--color-bg-overlay)]/90 backdrop-blur-xl shadow-glass flex items-center gap-3 cursor-pointer pointer-events-auto transition-all select-none max-w-sm w-80 transform-gpu ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
    >
      <span className="text-lg shrink-0">{typeIcon}</span>
      <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-normal flex-1">
        {toast.message}
      </p>
      <button className="text-[10px] text-[var(--color-text-tertiary)] hover:text-white transition-colors shrink-0 font-bold ml-2">
        ✕
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info', duration = 4000) => {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Stack Container */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
