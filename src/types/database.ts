// Database types for the Nursery Rhyme Video Studio

export type ProjectStatus = 'setup' | 'characters' | 'storyboard' | 'images' | 'videos' | 'export';
export type GenerationStatus = 'pending' | 'generating' | 'done' | 'failed';

export interface TimestampEntry {
  start: number;
  end: number;
  text: string;
}

export interface Project {
  id: string;
  name: string;
  audio_url: string | null;
  lyrics: string | null;
  timestamps: TimestampEntry[] | null;
  status: ProjectStatus;
  total_ai_cost: number;
  created_at: string;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  description: string;
  reference_images: string[];
  primary_image_url: string | null;
   character_type: 'character' | 'environment';
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  start_time: number;
  end_time: number;
  lyric_snippet: string;
  scene_description: string;
  characters_in_scene: string[];
  image_prompt: string;
  animation_prompt: string;
  image_url: string | null;
  image_status: GenerationStatus;
  image_approved: boolean;
  video_url: string | null;
  video_status: GenerationStatus;
  video_request_id: string | null;
  video_error: string | null;
  created_at: string;
}