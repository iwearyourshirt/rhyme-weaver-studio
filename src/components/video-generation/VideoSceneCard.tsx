import { useState, useEffect, useRef } from 'react';
import { Wand2, RefreshCw, Video, Play, Pause, AlertCircle, ChevronDown, ChevronUp, X, Save, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PromptFeedback } from '@/components/storyboard/PromptFeedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  onGenerate: () => void;
  onCancel: () => void;
  onUpdatePrompt: (prompt: string) => Promise<void>;
  onUpdateShotType: (shotType: ShotType) => Promise<void>;
  onApprovalChange: (approved: boolean) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// LTX Video 2.0 Fast: generation is fast but fal.ai queue wait adds time
// Typical total: 1-3 minutes including queue wait
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
  onUpdatePrompt,
  onUpdateShotType,
  onApprovalChange,
}: VideoSceneCardProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.animation_prompt);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startTimeRef = useRef<number | null>(null);
  // Track whether this generation was initiated in-session vs already running on mount
  const isResumedRef = useRef(false);
  // Track if user has unsaved local edits — prevents external refetches from resetting prompt
  const hasLocalEditsRef = useRef(false);

  // Timer effect for generation progress
  useEffect(() => {
    const isActuallyGeneratingNow = scene.video_status === 'generating';
    
    if (isActuallyGeneratingNow) {
      if (!startTimeRef.current) {
        // If we didn't initiate this generation (isGenerating from parent is false),
        // it's a resumed/in-progress generation from before page load
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

  // Sync edited prompt from server ONLY when user has no local edits
  useEffect(() => {
    if (!hasLocalEditsRef.current) {
      setEditedPrompt(scene.animation_prompt);
    }
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

  const [isSaving, setIsSaving] = useState(false);
  const hasPromptChanges = editedPrompt !== scene.animation_prompt;

  const handleSavePrompt = async () => {
    if (!hasPromptChanges) return;
    setIsSaving(true);
    try {
      await onUpdatePrompt(editedPrompt);
      hasLocalEditsRef.current = false; // Clear flag after successful save
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromptRewritten = (newPrompt: string) => {
    setEditedPrompt(newPrompt);
    hasLocalEditsRef.current = false; // AI rewrite saves immediately
    onUpdatePrompt(newPrompt);
  };

  const isActuallyGenerating = isGenerating || scene.video_status === 'generating';
  const canGenerate = scene.image_status === 'done' && scene.image_url;

  // Adaptive progress calculation - slows down as it approaches completion
  const getAdaptiveProgress = () => {
    if (elapsedTime < BASE_GENERATION_TIME) {
      // Normal progress up to base time (0-80%)
      return (elapsedTime / BASE_GENERATION_TIME) * 80;
    } else if (elapsedTime < MAX_GENERATION_TIME) {
      // Slow progress from 80% to 95% for longer generations
      const overtime = elapsedTime - BASE_GENERATION_TIME;
      const overtimeMax = MAX_GENERATION_TIME - BASE_GENERATION_TIME;
      return 80 + (overtime / overtimeMax) * 15;
    }
    return 95; // Cap at 95%
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
      {/* Horizontal layout: video left, controls right */}
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
          {isActuallyGenerating && (
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
          {/* Row 1: Scene number + Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Scene {scene.scene_number}</span>
            <StatusBadge status={scene.video_status} />
          </div>

          {/* Row 2: Time range */}
          <p className="text-xs text-muted-foreground font-mono">
            {formatTime(scene.start_time)} – {formatTime(scene.end_time)}
          </p>

          {/* Row 3: Lyric snippet */}
          <p className="text-xs text-muted-foreground italic line-clamp-2 leading-relaxed">
            "{scene.lyric_snippet}"
          </p>

          {/* Row 4: Shot Type Selector */}
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

          {/* Row 5: Animation Prompt Editor */}
          <Collapsible open={isPromptOpen} onOpenChange={setIsPromptOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-8 hover:bg-transparent">
                <span className="text-xs font-medium">Animation Prompt</span>
                {isPromptOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <Textarea
                value={editedPrompt}
                onChange={(e) => { setEditedPrompt(e.target.value); hasLocalEditsRef.current = true; }}
                className="text-xs min-h-[60px] resize-none"
                placeholder="Animation prompt..."
              />
              {hasPromptChanges && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleSavePrompt}
                  disabled={isSaving}
                >
                  <Save className="h-3 w-3 mr-1.5" />
                  {isSaving ? 'Saving...' : 'Save Prompt'}
                </Button>
              )}
              <PromptFeedback
                currentPrompt={editedPrompt}
                sceneDescription={scene.scene_description}
                promptType="animation"
                shotType={scene.shot_type}
                onRewrite={handlePromptRewritten}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Row 6: Generate / Download Buttons */}
          <div className="flex gap-2">
            <Button
              variant={scene.video_status === 'done' ? 'outline' : 'default'}
              className="flex-1 h-9"
              onClick={onGenerate}
              disabled={isActuallyGenerating || !canGenerate || scene.video_status === 'generating' || hasPromptChanges || (anyGenerating && !isGenerating)}
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
