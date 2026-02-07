import { useState, useRef, useCallback, useEffect } from 'react';
import { useUpdateScene } from '@/hooks/useScenes';

const DEBOUNCE_MS = 800;

/**
 * Manages a single scene's animation prompt with:
 * - Local state that is the source of truth
 * - Debounced auto-save to the database
 * - A `getLatestPrompt` callback for generation to read the current value
 * - `isDirty` flag (unsaved changes exist)
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
  const initializedRef = useRef(false);
  const updateScene = useUpdateScene();

  // Only sync from server on initial mount or when sceneId changes
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      setPrompt(serverPrompt);
      latestPromptRef.current = serverPrompt;
      isDirtyRef.current = false;
    }
  }, [sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If sceneId changes (different scene), re-initialize
  const prevSceneIdRef = useRef(sceneId);
  useEffect(() => {
    if (prevSceneIdRef.current !== sceneId) {
      prevSceneIdRef.current = sceneId;
      initializedRef.current = false;
    }
  }, [sceneId]);

  const saveToDb = useCallback(async (value: string) => {
    setIsSaving(true);
    try {
      await updateScene.mutateAsync({
        id: sceneId,
        projectId,
        updates: { animation_prompt: value },
      });
      isDirtyRef.current = false;
    } catch (err) {
      console.error('[useAnimationPrompt] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }, [sceneId, projectId, updateScene]);

  const onChange = useCallback((value: string) => {
    setPrompt(value);
    latestPromptRef.current = value;
    isDirtyRef.current = true;

    // Debounced auto-save
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveToDb(value);
    }, DEBOUNCE_MS);
  }, [saveToDb]);

  // Force-save immediately (e.g., before generation)
  const flushSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (isDirtyRef.current) {
      await saveToDb(latestPromptRef.current);
    }
  }, [saveToDb]);

  // Set prompt directly (e.g., from AI rewrite) and save immediately
  const setAndSave = useCallback(async (value: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setPrompt(value);
    latestPromptRef.current = value;
    isDirtyRef.current = true;
    await saveToDb(value);
  }, [saveToDb]);

  const getLatestPrompt = useCallback(() => latestPromptRef.current, []);

  // Cleanup debounce timer on unmount — save any pending changes
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        // Fire-and-forget save on unmount if dirty
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
    isDirty: isDirtyRef.current,
  };
}
