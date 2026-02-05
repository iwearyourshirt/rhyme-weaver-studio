import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Scene } from '@/types/database';

export function useScenesRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Force immediate refetch function
  const refetchScenes = useCallback(() => {
    if (projectId) {
      // Use refetchQueries for immediate refetch instead of just invalidation
      queryClient.refetchQueries({ 
        queryKey: ['scenes', projectId],
        exact: true,
      });
    }
  }, [projectId, queryClient]);

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
          // Force immediate refetch for updates (video/image status changes)
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
