import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ApiCall {
  timestamp: Date;
  type: string;
  request: unknown;
  response: unknown;
}

interface DebugContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  projectData: unknown;
  setProjectData: (data: unknown) => void;
  lastApiCall: ApiCall | null;
  logApiCall: (type: string, request: unknown, response: unknown) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [projectData, setProjectData] = useState<unknown>(null);
  const [lastApiCall, setLastApiCall] = useState<ApiCall | null>(null);

  const logApiCall = (type: string, request: unknown, response: unknown) => {
    setLastApiCall({
      timestamp: new Date(),
      type,
      request,
      response,
    });
  };

  return (
    <DebugContext.Provider
      value={{
        isOpen,
        setIsOpen,
        currentPage,
        setCurrentPage,
        projectData,
        setProjectData,
        lastApiCall,
        logApiCall,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}