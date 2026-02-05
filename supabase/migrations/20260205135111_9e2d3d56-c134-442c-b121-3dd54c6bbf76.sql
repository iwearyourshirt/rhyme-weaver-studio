-- Add shot_type column to scenes table
ALTER TABLE public.scenes 
ADD COLUMN shot_type text NOT NULL DEFAULT 'medium';

-- Add a comment explaining the valid values
COMMENT ON COLUMN public.scenes.shot_type IS 'Shot framing type: wide, medium, close-up, extreme-close-up, two-shot, over-shoulder';