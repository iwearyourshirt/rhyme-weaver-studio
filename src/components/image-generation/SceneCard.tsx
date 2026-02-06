import { useState, useEffect, useRef } from 'react';
import { Wand2, RefreshCw, ImageIcon, Check, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
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

interface SceneCardProps {
  scene: Scene;
  isGenerating: boolean;
  generatingAll: boolean;
  onGenerate: () => void;
  onApprovalChange: (approved: boolean) => void;
  onPromptSave: (updates: { image_prompt?: string; shot_type?: ShotType }) => Promise<void>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const ESTIMATED_GENERATION_TIME = 45; // seconds

export function SceneCard({
  scene,
  isGenerating,
  generatingAll,
  onGenerate,
  onApprovalChange,
  onPromptSave,
}: SceneCardProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(scene.image_prompt);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track elapsed time during generation
  useEffect(() => {
    if (isGenerating) {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isGenerating]);

  // Sync local prompt with scene prompt when it changes externally
  useEffect(() => {
    setEditedPrompt(scene.image_prompt);
  }, [scene.image_prompt]);

  const hasUnsavedChanges = editedPrompt !== scene.image_prompt;

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      await onPromptSave({ image_prompt: editedPrompt });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePromptRewritten = (newPrompt: string) => {
    setEditedPrompt(newPrompt);
  };

  const progressPercent = Math.min((elapsedTime / ESTIMATED_GENERATION_TIME) * 100, 95);

  return (
    <Card className="border overflow-hidden">
      {/* Image Area */}
      <div className="aspect-[3/2] bg-muted relative">
        {scene.image_url ? (
          <img
            src={scene.image_url}
            alt={`Scene ${scene.scene_number}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
          </div>
        )}
        
        {/* Generating overlay */}
        {isGenerating && (
          <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-2 p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-foreground border-t-transparent" />
            <div className="w-24">
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-foreground transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">
              {elapsedTime}s / ~{ESTIMATED_GENERATION_TIME}s
            </p>
          </div>
        )}
        
        {/* Approval checkbox */}
        <button 
          className={`absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded transition-colors ${
            scene.image_approved 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-white/90 text-muted-foreground border border-border hover:bg-white'
          }`}
          onClick={() => onApprovalChange(!scene.image_approved)}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
      
      {/* Content Area - consistent 16px padding, 12px gaps */}
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Scene number + Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Scene {scene.scene_number}</span>
          <StatusBadge status={scene.image_status} />
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
          onValueChange={(value: ShotType) => onPromptSave({ shot_type: value })}
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

        {/* Row 5: Collapsible prompt editor */}
        <Collapsible open={promptExpanded} onOpenChange={setPromptExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between px-0 h-8 hover:bg-transparent">
              <span className="text-xs font-medium">Image Prompt</span>
              {promptExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <Textarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              placeholder="Describe the image..."
              className="min-h-[80px] text-xs"
            />
            <PromptFeedback
              promptType="image"
              currentPrompt={editedPrompt}
              sceneDescription={scene.scene_description}
              shotType={scene.shot_type}
              onRewrite={handlePromptRewritten}
            />
            {hasUnsavedChanges && (
              <Button
                size="sm"
                className="w-full h-9"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Save Prompt
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Row 6: Generate Button */}
        <Button
          variant={scene.image_url ? 'outline' : 'default'}
          className="w-full h-9"
          onClick={onGenerate}
          disabled={isGenerating || generatingAll || scene.image_status === 'generating'}
        >
          {scene.image_url ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Regenerate
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Generate
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
