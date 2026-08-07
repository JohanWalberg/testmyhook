import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function useCopy() {
  const toast = useToast();
  return useCallback(
    (text: string, message: string) => {
      navigator.clipboard?.writeText(text).catch(() => {});
      toast(message);
    },
    [toast]
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((msg: string) => {
    clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 2400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 80, background: '#16161D', color: '#fff',
            borderRadius: 10, padding: '12px 16px', fontSize: 13.5, fontWeight: 500,
            boxShadow: '0 14px 36px -14px rgba(22,22,29,0.5)', animation: 'toastIn 160ms ease-out'
          }}
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
