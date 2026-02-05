import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Project, ProjectStatus, TimestampEntry } from '@/types/database';
import type { Json } from '@/integrations/supabase/types';

function mapProject(data: {
  id: string;
  name: string;
  audio_url: string | null;
  lyrics: string | null;
  timestamps: Json | null;
  status: string;
  created_at: string;
}): Project {
  let timestamps: TimestampEntry[] | null = null;
  if (data.timestamps && Array.isArray(data.timestamps)) {
    timestamps = data.timestamps as unknown as TimestampEntry[];
  }
  return {
    ...data,
    status: data.status as ProjectStatus,
    timestamps,
  };
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapProject);
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      return data ? mapProject(data) : null;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return mapProject(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<{
        name: string;
        audio_url: string | null;
        lyrics: string | null;
        timestamps: TimestampEntry[] | null;
        status: ProjectStatus;
      }>;
    }) => {
      const dbUpdates: Record<string, unknown> = { ...updates };
      if (updates.timestamps !== undefined) {
        dbUpdates.timestamps = updates.timestamps as unknown as Json;
      }
      
      const { data, error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return mapProject(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', data.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}