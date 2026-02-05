-- Add video generation tracking fields to scenes table
ALTER TABLE public.scenes 
ADD COLUMN IF NOT EXISTS video_request_id text,
ADD COLUMN IF NOT EXISTS video_error text;

-- Add comment for documentation
COMMENT ON COLUMN public.scenes.video_request_id IS 'fal.ai queue request ID for async video generation polling';
COMMENT ON COLUMN public.scenes.video_error IS 'Error message if video generation failed';