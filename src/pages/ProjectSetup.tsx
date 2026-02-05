import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Play, Pause, Save, Wand2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useDebug } from '@/contexts/DebugContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TimestampEntry } from '@/types/database';

export default function ProjectSetup() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

  const [projectName, setProjectName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [timestamps, setTimestamps] = useState<TimestampEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage('Project Setup');
    setProjectData(project);
  }, [setCurrentPage, setProjectData, project]);

  useEffect(() => {
    if (project) {
      setProjectName(project.name);
      setTimestamps(project.timestamps || []);
    }
  }, [project]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${projectId}/audio.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio')
        .getPublicUrl(fileName);

      await updateProject.mutateAsync({
        id: projectId,
        updates: { audio_url: publicUrl },
      });

      logApiCall('Audio Upload', { fileName }, { publicUrl });
      toast.success('Audio uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTranscribe = async () => {
    if (!project?.audio_url) {
      toast.error('Please upload an audio file first');
      return;
    }

    setIsTranscribing(true);
    
    try {
      const requestPayload = { audio_url: project.audio_url };
      
      console.log('Calling transcribe-audio edge function...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(requestPayload),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      logApiCall('Transcribe Audio', requestPayload, data);
      
      // Update local state with transcription results
      setTimestamps(data.timestamps);
      
      // Save to database
      if (projectId) {
        await updateProject.mutateAsync({
          id: projectId,
          updates: {
            lyrics: data.text,
            timestamps: data.timestamps,
          },
        });
      }
      
      toast.success('Transcription complete!');
    } catch (error) {
      console.error('Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      logApiCall('Transcribe Audio (Error)', { audio_url: project.audio_url }, { error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTimestampChange = (
    index: number,
    field: keyof TimestampEntry,
    value: string | number
  ) => {
    const updated = [...timestamps];
    updated[index] = { ...updated[index], [field]: value };
    setTimestamps(updated);
  };

  const handleSaveAndContinue = async () => {
    if (!projectId) return;

    try {
      await updateProject.mutateAsync({
        id: projectId,
        updates: {
          name: projectName,
          timestamps,
          lyrics: timestamps.map((t) => t.text).join('\n'),
          status: 'characters',
        },
      });
      toast.success('Project saved!');
      navigate(`/project/${projectId}/characters`);
    } catch (error) {
      toast.error('Failed to save project');
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Project Setup
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload your audio and transcribe the lyrics
        </p>
      </div>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Nursery Rhyme"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Audio File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/*"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
          />

          {project?.audio_url ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <audio
                  ref={audioRef}
                  src={project.audio_url}
                  onEnded={() => setIsPlaying(false)}
                  className="flex-1"
                  controls
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Replace Audio'}
                </Button>
                <Button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="gap-2"
                >
                  {isTranscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">
                {isUploading ? 'Uploading...' : 'Upload Audio File'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                MP3 or WAV files supported
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {timestamps.length > 0 && (
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>Lyrics & Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timestamps.map((entry, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg"
              >
                <div className="flex gap-2 items-center">
                  <div className="space-y-1">
                    <Label className="text-xs">Start (s)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={entry.start}
                      onChange={(e) =>
                        handleTimestampChange(index, 'start', parseFloat(e.target.value))
                      }
                      className="w-20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End (s)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={entry.end}
                      onChange={(e) =>
                        handleTimestampChange(index, 'end', parseFloat(e.target.value))
                      }
                      className="w-20"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Lyric Text</Label>
                  <Textarea
                    value={entry.text}
                    onChange={(e) =>
                      handleTimestampChange(index, 'text', e.target.value)
                    }
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSaveAndContinue}
          disabled={updateProject.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {updateProject.isPending ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}