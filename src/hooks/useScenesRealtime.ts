import { useEffect, useCallback, MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Scene } from '@/types/database';

const MUTATION_COOLDOWN_MS = 5000;

export function useScenesRealtime(
  projectId: string | undefined,
  lastMutationTimeRef?: MutableRefObject<number>
) {
  const queryClient = useQueryClient();

  // Force immediate refetch function (respects cooldown)
  const refetchScenes = useCallback(() => {
    if (!projectId) return;

    // Skip refetch if a mutation happened recently
    if (lastMutationTimeRef && Date.now() - lastMutationTimeRef.current < MUTATION_COOLDOWN_MS) {
      console.log('[Realtime] Skipping refetch — mutation cooldown active');
      return;
    }

    queryClient.refetchQueries({ 
      queryKey: ['scenes', projectId],
      exact: true,
    });
  }, [projectId, queryClient, lastMutationTimeRef]);

  useEffect(() => {
    if (!projectId) return;

    console.log(`[Realtime] Subscribing to scenes for project ${projectId}`);

    const channel = supabase
      .channel(`scenes-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scenes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('[Realtime] Scene updated:', payload.new);
          refetchScenes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'scenes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('[Realtime] Scene inserted:', payload.new);
          refetchScenes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'scenes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          console.log('[Realtime] Scene deleted:', payload.old);
          refetchScenes();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from scenes for project ${projectId}`);
      supabase.removeChannel(channel);
    };
  }, [projectId, refetchScenes]);

  return { refetchScenes };
}
