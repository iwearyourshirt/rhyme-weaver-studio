import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ApiCall {
  timestamp: Date;
  type: string;
  request: unknown;
  response: unknown;
}

interface PromptLog {
  timestamp: Date;
  type: string;
  prompts: string[];
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
  promptLogs: PromptLog[];
  logPrompts: (type: string, prompts: string[]) => void;
  clearPromptLogs: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [projectData, setProjectData] = useState<unknown>(null);
  const [lastApiCall, setLastApiCall] = useState<ApiCall | null>(null);
  const [promptLogs, setPromptLogs] = useState<PromptLog[]>([]);

  const logApiCall = (type: string, request: unknown, response: unknown) => {
    setLastApiCall({
      timestamp: new Date(),
      type,
      request,
      response,
    });
  };

  const logPrompts = (type: string, prompts: string[]) => {
    setPromptLogs((prev) => [
      {
        timestamp: new Date(),
        type,
        prompts,
      },
      ...prev.slice(0, 9), // Keep last 10 prompt logs
    ]);
  };

  const clearPromptLogs = () => {
    setPromptLogs([]);
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
        promptLogs,
        logPrompts,
        clearPromptLogs,
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