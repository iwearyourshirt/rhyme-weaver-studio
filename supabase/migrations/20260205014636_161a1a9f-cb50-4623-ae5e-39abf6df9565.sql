-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  audio_url TEXT,
  lyrics TEXT,
  timestamps JSONB,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'characters', 'storyboard', 'images', 'videos', 'export')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create characters table
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_images JSONB DEFAULT '[]'::jsonb,
  primary_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scenes table
CREATE TABLE public.scenes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  start_time NUMERIC NOT NULL,
  end_time NUMERIC NOT NULL,
  lyric_snippet TEXT NOT NULL,
  scene_description TEXT NOT NULL,
  characters_in_scene JSONB DEFAULT '[]'::jsonb,
  image_prompt TEXT NOT NULL,
  animation_prompt TEXT NOT NULL,
  image_url TEXT,
  image_status TEXT NOT NULL DEFAULT 'pending' CHECK (image_status IN ('pending', 'generating', 'done', 'failed')),
  video_url TEXT,
  video_status TEXT NOT NULL DEFAULT 'pending' CHECK (video_status IN ('pending', 'generating', 'done', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_characters_project_id ON public.characters(project_id);
CREATE INDEX idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX idx_scenes_scene_number ON public.scenes(project_id, scene_number);

-- Enable RLS on all tables (single-user app, but good practice)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (single-user app, no auth needed)
CREATE POLICY "Allow all operations on projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on characters" ON public.characters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on scenes" ON public.scenes FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', true);

-- Create storage policy for audio bucket
CREATE POLICY "Allow public read access on audio" ON storage.objects FOR SELECT USING (bucket_id = 'audio');
CREATE POLICY "Allow public upload on audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio');
CREATE POLICY "Allow public update on audio" ON storage.objects FOR UPDATE USING (bucket_id = 'audio');
CREATE POLICY "Allow public delete on audio" ON storage.objects FOR DELETE USING (bucket_id = 'audio');