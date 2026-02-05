-- Add creative direction fields to projects table
ALTER TABLE public.projects
ADD COLUMN style_direction text,
ADD COLUMN animation_direction text,
ADD COLUMN cinematography_direction text,
ADD COLUMN creative_brief text;