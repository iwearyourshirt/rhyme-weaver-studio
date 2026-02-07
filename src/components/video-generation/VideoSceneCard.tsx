import { useState, useEffect, useRef, useCallback } from 'react';
import { Wand2, RefreshCw, Video, Play, Pause, AlertCircle, ChevronDown, ChevronUp, X, Download, Check, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PromptFeedback } from '@/components/storyboard/PromptFeedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Scene, ShotType } from '@/types/database';

const SHOT_TYPE_OPTIONS: { value: ShotType; label: string }[] = [
  { value: 'wide', label: 'Wide Shot' },
  { value: 'medium', label: 'Medium Shot' },
  { value: 'close-up', label: 'Close-Up' },
  { value: 'extreme-close-up', label: 'Extreme Close-Up' },
  { value: 'two-shot', label: 'Two-Shot' },
  { value: 'over-shoulder', label: 'Over-the-Shoulder' },
];

interface VideoSceneCardProps {
  scene: Scene;
  projectId: string;
  isGenerating: boolean;
  anyGenerating?: boolean;
  isCancelling?: boolean;
  onGenerate: (prompt: string) => void;
  onCancel: () => void;
  onUpdateShotType: (shotType: ShotType) => Promise<void>;
  onApprovalChange: (approved: boolean) => void;
  onDeleteVideo: () => Promise<void>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const BASE_GENERATION_TIME = 90;
const MAX_GENERATION_TIME = 180;

export function VideoSceneCard({
  scene,
  projectId,
  isGenerating,
  anyGenerating = false,
  isCancelling = false,
  onGenerate,
  onCancel,
  onUpdateShotType,
  onApprovalChange,
  onDeleteVideo,
}: VideoSceneCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  const isResumedRef = useRef(false);

  // Simple local state for animation prompt
  const [editedPrompt, setEditedPrompt] = useState(scene.animation_prompt || '');
  const [isSaving, setIsSaving] = useState(false);
  const prevSceneIdRef = useRef(scene.id);

  // Re-sync only when switching to a different scene
  if (prevSceneIdRef.current !== scene.id) {
    prevSceneIdRef.current = scene.id;
    setEditedPrompt(scene.animation_prompt || '');
  }

  // Debounced auto-save
  useEffect(() => {
    if (editedPrompt === (scene.animation_prompt || '')) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      await supabase
        .from('scenes')
        .update({ animation_prompt: editedPrompt })
        .eq('id', scene.id);
      setIsSaving(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [editedPrompt, scene.id]);

  // Timer effect for generation progress
  useEffect(() => {
    const isActuallyGeneratingNow = scene.video_status === 'generating';
    
    if (isActuallyGeneratingNow) {
      if (!startTimeRef.current) {
        isResumedRef.current = !isGenerating;
        startTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setElapsedTime(elapsed);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      startTimeRef.current = null;
      isResumedRef.current = false;
      setElapsedTime(0);
    }
  }, [scene.video_status]);

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

  const handleGenerate = () => {
    onGenerate(editedPrompt);
  };

  const handlePromptRewritten = async (newPrompt: string) => {
    setEditedPrompt(newPrompt);
    await supabase
      .from('scenes')
      .update({ animation_prompt: newPrompt })
      .eq('id', scene.id);
  };

  const isActuallyGenerating = scene.video_status === 'generating';
  const canGenerate = scene.image_status === 'done' && scene.image_url;

  const getAdaptiveProgress = () => {
    if (elapsedTime < BASE_GENERATION_TIME) {
      return (elapsedTime / BASE_GENERATION_TIME) * 80;
    } else if (elapsedTime < MAX_GENERATION_TIME) {
      const overtime = elapsedTime - BASE_GENERATION_TIME;
      const overtimeMax = MAX_GENERATION_TIME - BASE_GENERATION_TIME;
      return 80 + (overtime / overtimeMax) * 15;
    }
    return 95;
  };

  const progressPercent = getAdaptiveProgress();

  const getTimeDisplay = () => {
    if (elapsedTime < BASE_GENERATION_TIME) {
      const remaining = BASE_GENERATION_TIME - elapsedTime;
      return `~${remaining}s remaining`;
    } else if (elapsedTime < MAX_GENERATION_TIME) {
      return 'Finishing up...';
    }
    return 'Almost done...';
  };

  return (
    <Card className="border overflow-hidden">
      <div className="flex flex-row">
        {/* Video/Image Area */}
        <div className="w-1/2 aspect-video bg-muted relative flex-shrink-0">
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
              <button
                className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                onClick={handlePlayPause}
              >
                <div className="bg-white rounded-full p-2.5">
                  {isPlaying ? (
                    <Pause className="h-5 w-5 text-foreground fill-current" />
                  ) : (
                    <Play className="h-5 w-5 text-foreground fill-current" />
                  )}
                </div>
              </button>
            </>
          ) : scene.image_url ? (
            <img
              src={scene.image_url}
              alt={`Scene ${scene.scene_number}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Video className="h-8 w-8 text-muted-foreground/20" />
            </div>
          )}

          {/* Generating overlay */}
          {isActuallyGenerating && scene.video_status !== 'failed' && (
            <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-2 p-4">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-foreground border-t-transparent" />
              <p className="text-xs font-medium">{isCancelling ? 'Cancelling...' : 'Generating...'}</p>
              {isResumedRef.current ? (
                <p className="text-[10px] text-muted-foreground font-mono">
                  In progress — waiting for result...
                </p>
              ) : (
                <>
                  <div className="w-24">
                    <Progress value={progressPercent} className="h-1" />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {elapsedTime}s • {getTimeDisplay()}
                  </p>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelling}
                className="h-7 text-xs mt-1"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Error state */}
          {scene.video_status === 'failed' && (
            <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center">
              <div className="text-center p-4">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-1" />
                <p className="text-[10px] text-destructive">{scene.video_error || 'Generation failed'}</p>
              </div>
            </div>
          )}

          {/* Delete video button */}
          {scene.video_status === 'done' && scene.video_url && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="absolute top-2 left-2 flex items-center justify-center w-6 h-6 rounded bg-white/90 text-muted-foreground border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors z-10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete video for Scene {scene.scene_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the generated video and revert the scene back to its image. You can regenerate the video afterwards.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteVideo} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Video
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Approval checkbox */}
          {scene.video_status === 'done' && scene.video_url && (
            <button 
              className={`absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded transition-colors z-10 ${
                scene.video_approved 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-white/90 text-muted-foreground border border-border hover:bg-white'
              }`}
              onClick={() => onApprovalChange(!scene.video_approved)}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}

          {!canGenerate && scene.video_status === 'pending' && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Generate scene image first</p>
            </div>
          )}
        </div>

        {/* Content Area */}
        <CardContent className="w-1/2 p-4 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Scene {scene.scene_number}</span>
            <StatusBadge status={scene.video_status} />
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            {formatTime(scene.start_time)} – {formatTime(scene.end_time)}
          </p>

          <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">
            "{scene.lyric_snippet}"
          </p>

          <Select
            value={scene.shot_type}
            onValueChange={(value: ShotType) => onUpdateShotType(value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Shot type" />
            </SelectTrigger>
            <SelectContent>
              {SHOT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Animation Prompt Editor */}
          <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-8 hover:bg-transparent">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  Animation Prompt
                  {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </span>
                {isPromptOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <Textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="text-xs min-h-[60px] resize-none"
                placeholder="Animation prompt..."
              />
              <PromptFeedback
                currentPrompt={editedPrompt}
                sceneDescription={scene.scene_description}
                promptType="animation"
                shotType={scene.shot_type}
                onRewrite={handlePromptRewritten}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Generate / Download Buttons */}
          <div className="flex gap-2">
            <Button
              variant={scene.video_status === 'done' ? 'outline' : 'default'}
              className="flex-1 h-9"
              onClick={handleGenerate}
              disabled={isActuallyGenerating || !canGenerate || scene.video_status === 'generating'}
            >
              {scene.video_status === 'done' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Regenerate
                </>
              ) : scene.video_status === 'failed' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Retry
                </>
              ) : (
                <>
                  <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                  Generate
                </>
              )}
            </Button>
            {scene.video_status === 'done' && scene.video_url && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                asChild
              >
                <a href={scene.video_url} download={`scene-${scene.scene_number}.mp4`} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
