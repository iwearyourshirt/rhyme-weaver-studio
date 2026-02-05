-- Create cost_logs table for tracking AI API costs
CREATE TABLE public.cost_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  tokens_input INTEGER,
  tokens_output INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cost_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (matching existing project permissions)
CREATE POLICY "Allow all operations on cost_logs"
ON public.cost_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add total_ai_cost column to projects table
ALTER TABLE public.projects
ADD COLUMN total_ai_cost NUMERIC NOT NULL DEFAULT 0;

-- Create index for faster queries by project
CREATE INDEX idx_cost_logs_project_id ON public.cost_logs(project_id);

-- Create index for ordering by created_at
CREATE INDEX idx_cost_logs_created_at ON public.cost_logs(created_at DESC);

-- Enable realtime for cost_logs so UI updates immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_logs;