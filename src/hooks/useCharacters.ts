import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Character } from '@/types/database';

export function useCharacters(projectId: string | undefined) {
  return useQuery({
    queryKey: ['characters', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(char => ({
        ...char,
        reference_images: (char.reference_images as string[]) || [],
         character_type: (char.character_type as 'character' | 'environment') || 'character',
      })) as Character[];
    },
    enabled: !!projectId,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      projectId, 
      name, 
      description 
    }: { 
      projectId: string; 
      name: string; 
      description: string;
    }) => {
      const { data, error } = await supabase
        .from('characters')
        .insert({ 
          project_id: projectId, 
          name, 
          description,
          reference_images: [],
        })
        .select()
        .single();
      
      if (error) throw error;
      return {
        ...data,
        reference_images: (data.reference_images as string[]) || [],
      } as Character;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['characters', data.project_id] });
    },
  });
}

export function useUpdateCharacter() {
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
        name: string;
        description: string;
        reference_images: string[];
        primary_image_url: string | null;
         character_type: 'character' | 'environment';
      }>;
    }) => {
      const { data, error } = await supabase
        .from('characters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return {
        ...data,
        reference_images: (data.reference_images as string[]) || [],
         character_type: (data.character_type as 'character' | 'environment') || 'character',
      } as Character;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['characters', variables.projectId] });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('characters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['characters', variables.projectId] });
    },
  });
}