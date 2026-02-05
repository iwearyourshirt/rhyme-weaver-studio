import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Scene, GenerationStatus } from '@/types/database';

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
        image_prompt: string;
        animation_prompt: string;
        image_url: string | null;
        image_status: GenerationStatus;
        video_url: string | null;
        video_status: GenerationStatus;
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
    onSuccess: (_, variables) => {
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