import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkApiHealth } from '@/lib/api';

interface ApiStatusContextType {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  isMockMode: boolean;
}

const ApiStatusContext = createContext<ApiStatusContextType>({
  isOnline: false,
  isChecking: true,
  lastChecked: null,
  isMockMode: false,
});

export const useApiStatus = () => useContext(ApiStatusContext);

export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  useEffect(() => {
    const checkStatus = async () => {
      setIsChecking(true);
      const healthy = await checkApiHealth();
      setIsOnline(healthy);
      setLastChecked(new Date());
      setIsChecking(false);
    };

    // Check immediately
    checkStatus();

    // Then check every 30 seconds (only if not in mock mode)
    if (!isMockMode) {
      const interval = setInterval(checkStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isMockMode]);

  return (
    <ApiStatusContext.Provider value={{ isOnline, isChecking, lastChecked, isMockMode }}>
      {children}
    </ApiStatusContext.Provider>
  );
}
