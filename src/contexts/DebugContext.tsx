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

interface VideoSceneStatus {
  sceneNumber: number;
  sceneId: string;
  status: 'pending' | 'generating' | 'done' | 'failed';
  requestId?: string;
  generationStartTime?: number;
  generationEndTime?: number;
  videoUrl?: string;
  error?: string;
}

interface VideoGenerationDebug {
  model: string;
  scenes: VideoSceneStatus[];
  totalGenerationTimeMs: number;
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
  videoDebug: VideoGenerationDebug;
  updateVideoSceneStatus: (scene: VideoSceneStatus) => void;
  setVideoModel: (model: string) => void;
  clearVideoDebug: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

const DEFAULT_VIDEO_DEBUG: VideoGenerationDebug = {
  model: 'fal-ai/ltx-2/image-to-video/fast',
  scenes: [],
  totalGenerationTimeMs: 0,
};

export function DebugProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('');
  const [projectData, setProjectData] = useState<unknown>(null);
  const [lastApiCall, setLastApiCall] = useState<ApiCall | null>(null);
  const [promptLogs, setPromptLogs] = useState<PromptLog[]>([]);
  const [videoDebug, setVideoDebug] = useState<VideoGenerationDebug>(DEFAULT_VIDEO_DEBUG);

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

  const updateVideoSceneStatus = (scene: VideoSceneStatus) => {
    setVideoDebug((prev) => {
      const existingIndex = prev.scenes.findIndex((s) => s.sceneId === scene.sceneId);
      let newScenes: VideoSceneStatus[];
      
      if (existingIndex >= 0) {
        newScenes = [...prev.scenes];
        newScenes[existingIndex] = { ...newScenes[existingIndex], ...scene };
      } else {
        newScenes = [...prev.scenes, scene].sort((a, b) => a.sceneNumber - b.sceneNumber);
      }

      // Calculate total generation time from completed scenes
      const totalGenerationTimeMs = newScenes.reduce((total, s) => {
        if (s.status === 'done' && s.generationStartTime && s.generationEndTime) {
          return total + (s.generationEndTime - s.generationStartTime);
        }
        return total;
      }, 0);

      return { ...prev, scenes: newScenes, totalGenerationTimeMs };
    });
  };

  const setVideoModel = (model: string) => {
    setVideoDebug((prev) => ({ ...prev, model }));
  };

  const clearVideoDebug = () => {
    setVideoDebug(DEFAULT_VIDEO_DEBUG);
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
        videoDebug,
        updateVideoSceneStatus,
        setVideoModel,
        clearVideoDebug,
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