import { useState, useEffect, useRef } from 'react';
import { Wand2, RefreshCw, Video, Play, Pause, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PromptFeedback } from '@/components/storyboard/PromptFeedback';
import type { Scene } from '@/types/database';

interface VideoSceneCardProps {
  scene: Scene;
  projectId: string;
  isGenerating: boolean;
  onGenerate: () => void;
  onUpdatePrompt: (prompt: string) => Promise<void>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Estimated generation time in seconds (LTX Video 2.0 Fast: ~10-30 seconds)
const ESTIMATED_GENERATION_TIME = 25;

export function VideoSceneCard({
  scene,
  projectId,
  isGenerating,
  onGenerate,
  onUpdatePrompt,
}: VideoSceneCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.animation_prompt);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  // Track if we initiated this generation in the current session
  const initiatedThisSessionRef = useRef(false);

  // Timer effect for generation progress - only tracks time if we initiated the generation
  useEffect(() => {
    const isActuallyGeneratingNow = scene.video_status === 'generating';
    
    if (isActuallyGeneratingNow) {
      // Only start a fresh timer if we initiated this generation in this session
      if (isGenerating && !startTimeRef.current) {
        startTimeRef.current = Date.now();
        initiatedThisSessionRef.current = true;
      }

      // Only run timer if we have a start time (meaning we initiated it)
      if (startTimeRef.current) {
        const interval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
          setElapsedTime(elapsed);
        }, 1000);

        return () => clearInterval(interval);
      }
    } else {
      // Reset when done/failed
      startTimeRef.current = null;
      initiatedThisSessionRef.current = false;
      setElapsedTime(0);
    }
  }, [isGenerating, scene.video_status]);

  // Reset edited prompt when scene changes
  useEffect(() => {
    setEditedPrompt(scene.animation_prompt);
  }, [scene.animation_prompt]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
  };

  const handlePromptBlur = async () => {
    if (editedPrompt !== scene.animation_prompt) {
      await onUpdatePrompt(editedPrompt);
    }
  };

  const handlePromptRewritten = (newPrompt: string) => {
    setEditedPrompt(newPrompt);
    onUpdatePrompt(newPrompt);
  };

  const isActuallyGenerating = isGenerating || scene.video_status === 'generating';
  const progressPercent = Math.min((elapsedTime / ESTIMATED_GENERATION_TIME) * 100, 95);
  const canGenerate = scene.image_status === 'done' && scene.image_url;

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEstimatedRemaining = () => {
    const remaining = Math.max(ESTIMATED_GENERATION_TIME - elapsedTime, 0);
    if (remaining <= 0) return 'Almost done...';
    if (remaining < 10) return `~${remaining}s remaining`;
    return `~${Math.ceil(remaining / 5) * 5}s remaining`;
  };

  return (
    <Card className="card-shadow overflow-hidden group">
      {/* Horizontal layout for smaller screens, vertical for larger */}
      <div className="flex flex-row lg:flex-col">
        {/* Video/Image section - 2/3 width on small screens, full width on large */}
        <div className="w-2/3 lg:w-full aspect-video bg-muted relative flex-shrink-0">
          {scene.video_status === 'done' && scene.video_url ? (
            <>
              <video
                ref={videoRef}
                src={scene.video_url}
                className="w-full h-full object-cover"
                onEnded={handleVideoEnded}
                loop={false}
                playsInline
              />
              <div
                className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePlayPause}
              >
                <div className="bg-primary rounded-full p-3">
                  {isPlaying ? (
                    <Pause className="h-6 w-6 text-primary-foreground fill-current" />
                  ) : (
                    <Play className="h-6 w-6 text-primary-foreground fill-current" />
                  )}
                </div>
              </div>
            </>
          ) : scene.image_url ? (
            <img
              src={scene.image_url}
              alt={`Scene ${scene.scene_number}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Generating overlay */}
          {isActuallyGenerating && (
            <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-3" />
              <p className="text-sm font-medium text-foreground mb-2">Generating video...</p>
              <Progress value={initiatedThisSessionRef.current ? progressPercent : 50} className="w-full max-w-[120px] h-1.5 mb-2" />
              <p className="text-xs text-muted-foreground">
                {initiatedThisSessionRef.current 
                  ? `${formatElapsed(elapsedTime)} elapsed • ${getEstimatedRemaining()}`
                  : 'Generation in progress...'}
              </p>
            </div>
          )}

          {/* Error state */}
          {scene.video_status === 'failed' && (
            <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
              <div className="text-center p-4">
                <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                <p className="text-xs text-destructive">{scene.video_error || 'Generation failed'}</p>
              </div>
            </div>
          )}

          {/* No image yet overlay */}
          {!canGenerate && scene.video_status === 'pending' && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center px-4">
                Generate scene image first
              </p>
            </div>
          )}
        </div>

        {/* Content section - 1/3 width on small screens, full width on large */}
        <CardContent className="p-3 space-y-3 w-1/3 lg:w-full flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Scene {scene.scene_number}</span>
              <StatusBadge status={scene.video_status} />
            </div>

            <p className="text-xs text-muted-foreground">
              {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
            </p>

            <p className="text-xs text-muted-foreground line-clamp-2 italic">
              "{scene.lyric_snippet}"
            </p>
          </div>

          {/* Animation Prompt Editor */}
          <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-2 h-8">
                <span className="text-xs">Animation Prompt</span>
                {isPromptOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                onBlur={handlePromptBlur}
                className="text-xs min-h-[60px] resize-none"
                placeholder="Animation prompt..."
              />
              <PromptFeedback
                currentPrompt={editedPrompt}
                sceneDescription={scene.scene_description}
                promptType="animation"
                onRewrite={handlePromptRewritten}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Generate Button */}
          <Button
            size="sm"
            variant={scene.video_status === 'done' ? 'outline' : 'default'}
            className="w-full gap-1.5"
            onClick={onGenerate}
            disabled={isActuallyGenerating || !canGenerate}
          >
            {scene.video_status === 'done' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </>
            ) : scene.video_status === 'failed' ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </>
            ) : (
              <>
                <Wand2 className="h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
