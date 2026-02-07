import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const DEBOUNCE_MS = 800;

/**
 * Manages a single scene's animation prompt with:
 * - Local state as the source of truth (never overwritten by server)
 * - Debounced auto-save to DB
 * - `flushSave` to force-save before generation
 * - `setAndSave` for AI rewrite
 */
export function useAnimationPrompt(
  sceneId: string,
  projectId: string,
  serverPrompt: string
) {
  const [prompt, setPrompt] = useState(serverPrompt);
  const [isSaving, setIsSaving] = useState(false);
  const isDirtyRef = useRef(false);
  const latestPromptRef = useRef(serverPrompt);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSceneIdRef = useRef(sceneId);
  const queryClient = useQueryClient();

  // Re-initialize when sceneId changes (different scene)
  if (prevSceneIdRef.current !== sceneId) {
    prevSceneIdRef.current = sceneId;
    setPrompt(serverPrompt);
    latestPromptRef.current = serverPrompt;
    isDirtyRef.current = false;
  }

  // Stable save function using refs — no dependencies that change per render
  const sceneIdRef = useRef(sceneId);
  const projectIdRef = useRef(projectId);
  sceneIdRef.current = sceneId;
  projectIdRef.current = projectId;

  const saveToDb = useCallback(async (value: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('scenes')
        .update({ animation_prompt: value })
        .eq('id', sceneIdRef.current);

      if (error) throw error;
      isDirtyRef.current = false;

      // Silently update cache without triggering refetch
      queryClient.setQueryData<any[]>(['scenes', projectIdRef.current], (old) =>
        old?.map((s) =>
          s.id === sceneIdRef.current ? { ...s, animation_prompt: value } : s
        ) ?? []
      );
    } catch (err) {
      console.error('[useAnimationPrompt] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [queryClient]);

  const onChange = useCallback((value: string) => {
    setPrompt(value);
    latestPromptRef.current = value;
    isDirtyRef.current = true;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveToDb(value);
    }, DEBOUNCE_MS);
  }, [saveToDb]);

  const flushSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (isDirtyRef.current) {
      await saveToDb(latestPromptRef.current);
    }
  }, [saveToDb]);

  const setAndSave = useCallback(async (value: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPrompt(value);
    latestPromptRef.current = value;
    isDirtyRef.current = true;
    await saveToDb(value);
  }, [saveToDb]);

  const getLatestPrompt = useCallback(() => latestPromptRef.current, []);

  // Cleanup: save pending changes on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        if (isDirtyRef.current) {
          saveToDb(latestPromptRef.current);
        }
      }
    };
  }, [saveToDb]);

  return {
    prompt,
    onChange,
    flushSave,
    setAndSave,
    getLatestPrompt,
    isSaving,
  };
}
