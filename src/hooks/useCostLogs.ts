import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface CostLog {
  id: string;
  project_id: string;
  service: string;
  operation: string;
  cost: number;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string;
}

export function useCostLogs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['cost-logs', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('cost_logs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CostLog[];
    },
    enabled: !!projectId,
  });
}

export function useCostLogsRealtime(projectId: string | undefined) {
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`cost-logs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cost_logs',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          // Invalidate the query to refetch
          window.dispatchEvent(new CustomEvent('cost-log-updated', { detail: { projectId } }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}

// Service name mapping for friendly display
export const SERVICE_NAMES: Record<string, string> = {
  'openai-gpt4o': 'OpenAI GPT-4o (Text)',
  'openai-gpt4o-mini': 'OpenAI GPT-4o Mini (Text)',
  'openai-gpt-image-1': 'OpenAI Image Generation',
  'fal-ltx-video-fast': 'LTX Video 2.0 Fast',
  'fal-flux-kontext': 'FLUX Kontext (Images)',
  'fal-deepgram': 'Deepgram (Transcription)',
  'fal-whisper': 'Whisper (Transcription)',
  'lovable-ai': 'Lovable AI (Text)',
};

export function getServiceName(serviceId: string): string {
  return SERVICE_NAMES[serviceId] || serviceId;
}
