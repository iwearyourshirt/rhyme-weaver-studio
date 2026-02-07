import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Scene, GenerationStatus, ShotType } from '@/types/database';

export function useScenes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['scenes', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('scenes')
        .select('*')
        .eq('project_id', projectId)
        .order('scene_number', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(scene => ({
        ...scene,
        start_time: Number(scene.start_time),
        end_time: Number(scene.end_time),
        characters_in_scene: (scene.characters_in_scene as string[]) || [],
        image_approved: scene.image_approved ?? false,
        video_approved: (scene as any).video_approved ?? false,
      })) as Scene[];
    },
    enabled: !!projectId,
  });
}

export function useCreateScene() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (scene: Omit<Scene, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('scenes')
        .insert(scene)
        .select()
        .single();
      
      if (error) throw error;
      return {
        ...data,
        start_time: Number(data.start_time),
        end_time: Number(data.end_time),
        characters_in_scene: (data.characters_in_scene as string[]) || [],
      } as Scene;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', data.project_id] });
    },
  });
}

export function useUpdateScene() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      projectId,
      updates 
    }: { 
      id: string;
      projectId: string;
      updates: Partial<{
        scene_description: string;
        characters_in_scene: string[];
        shot_type: ShotType;
        image_prompt: string;
        animation_prompt: string;
        image_url: string | null;
        image_status: GenerationStatus;
        image_approved: boolean;
        video_url: string | null;
        video_status: GenerationStatus;
        video_request_id: string | null;
        video_error: string | null;
        video_approved: boolean;
        scene_number: number;
        start_time: number;
        end_time: number;
        lyric_snippet: string;
      }>;
    }) => {
      const { data, error } = await supabase
        .from('scenes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return {
        ...data,
        start_time: Number(data.start_time),
        end_time: Number(data.end_time),
        characters_in_scene: (data.characters_in_scene as string[]) || [],
      } as Scene;
    },
    onMutate: async (variables) => {
      // Cancel in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: ['scenes', variables.projectId] });

      const previousScenes = queryClient.getQueryData<Scene[]>(['scenes', variables.projectId]);

      // Optimistically apply the update to the cache
      queryClient.setQueryData<Scene[]>(['scenes', variables.projectId], (old) =>
        old?.map((scene) =>
          scene.id === variables.id ? { ...scene, ...variables.updates } : scene
        ) ?? []
      );

      return { previousScenes };
    },
    onError: (_err, variables, context) => {
      // Rollback on failure
      if (context?.previousScenes) {
        queryClient.setQueryData(['scenes', variables.projectId], context.previousScenes);
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', variables.projectId] });
    },
  });
}

export function useBulkCreateScenes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ projectId, scenes }: { projectId: string; scenes: Omit<Scene, 'id' | 'created_at'>[] }) => {
      const { error } = await supabase
        .from('scenes')
        .insert(scenes);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', variables.projectId] });
    },
  });
}

export function useDeleteScenes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('scenes')
        .delete()
        .eq('project_id', projectId);
      
      if (error) throw error;
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', projectId] });
    },
  });
}

export function useDeleteScene() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('scenes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', variables.projectId] });
    },
  });
}

export function useRenumberScenes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ projectId, sceneUpdates }: { 
      projectId: string; 
      sceneUpdates: { id: string; scene_number: number }[] 
    }) => {
      for (const update of sceneUpdates) {
        const { error } = await supabase
          .from('scenes')
          .update({ scene_number: update.scene_number })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scenes', variables.projectId] });
    },
  });
}