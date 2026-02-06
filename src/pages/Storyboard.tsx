import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, GripVertical, ChevronDown, ChevronUp, Scissors, Merge, Trash2, Save, Loader2, Clock, Film, RefreshCw, ImageIcon, Plus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PromptFeedback } from '@/components/storyboard/PromptFeedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShotType } from '@/types/database';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Textarea } from '@/components/ui/textarea';
 import { Badge } from '@/components/ui/badge';
 import {
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
 } from '@/components/ui/collapsible';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger,
 } from '@/components/ui/alert-dialog';
 import { useProject, useUpdateProject } from '@/hooks/useProjects';
 import { useCharacters } from '@/hooks/useCharacters';
import { useScenes, useCreateScene, useUpdateScene, useDeleteScenes, useDeleteScene, useRenumberScenes } from '@/hooks/useScenes';
import { useScenesRealtime } from '@/hooks/useScenesRealtime';
 import { useDebug } from '@/contexts/DebugContext';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import type { Scene } from '@/types/database';
 
 function formatTime(seconds: number): string {
   const mins = Math.floor(seconds / 60);
   const secs = Math.floor(seconds % 60);
   return `${mins}:${secs.toString().padStart(2, '0')}`;
 }
 
 function formatDuration(seconds: number): string {
   const mins = Math.floor(seconds / 60);
   const secs = Math.floor(seconds % 60);
   if (mins > 0) {
     return `${mins}m ${secs}s`;
   }
   return `${secs}s`;
 }
 
interface SceneEdits {
  scene_description?: string;
  image_prompt?: string;
  animation_prompt?: string;
  shot_type?: ShotType;
}

const SHOT_TYPE_OPTIONS: { value: ShotType; label: string }[] = [
  { value: 'wide', label: 'Wide Shot' },
  { value: 'medium', label: 'Medium Shot' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'extreme-close-up', label: 'Extreme Close-up' },
  { value: 'two-shot', label: 'Two Shot' },
  { value: 'over-shoulder', label: 'Over Shoulder' },
];

export default function Storyboard() {
   const { projectId } = useParams();
   const navigate = useNavigate();
   const { data: project } = useProject(projectId);
   const { data: characters } = useCharacters(projectId);
   const { data: scenes, isLoading } = useScenes(projectId);
   const createScene = useCreateScene();
   const updateScene = useUpdateScene();
   const deleteScenes = useDeleteScenes();
   const deleteScene = useDeleteScene();
   const renumberScenes = useRenumberScenes();
   const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall, logPrompts } = useDebug();

  // Enable realtime updates for cross-page sync
  useScenesRealtime(projectId);
 
   const [isGenerating, setIsGenerating] = useState(false);
   const [expandedPrompts, setExpandedPrompts] = useState<Record<string, boolean>>({});
   const [sceneEdits, setSceneEdits] = useState<Record<string, SceneEdits>>({});
   const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
 
   useEffect(() => {
     setCurrentPage('Storyboard');
     setProjectData({ project, characters, scenes });
   }, [setCurrentPage, setProjectData, project, characters, scenes]);
 
   const handleGenerateStoryboard = async () => {
     if (!projectId) return;
 
     setIsGenerating(true);
 
     try {
       const requestPayload = { project_id: projectId };
       
        console.log('Calling generate-storyboard edge function...');

        const { data, error } = await supabase.functions.invoke('generate-storyboard', {
          body: requestPayload,
        });

        if (error) {
          throw new Error(error.message || 'Storyboard generation failed');
        }

        if (!data) {
          throw new Error('Storyboard generation returned no data');
        }
 
       logApiCall('Generate Storyboard', requestPayload, data);
       
       if (data.prompt) {
         logPrompts('Generate Storyboard - System', [data.prompt.system]);
         logPrompts('Generate Storyboard - User', [data.prompt.user]);
       }
       
       setSceneEdits({});
       
       toast.success(`Storyboard generated with ${data.scenes?.length || 0} scenes!`);
     } catch (error) {
       console.error('Storyboard generation error:', error);
       const errorMessage = error instanceof Error ? error.message : 'Storyboard generation failed';
       logApiCall('Generate Storyboard (Error)', { projectId }, { error: errorMessage });
       toast.error(errorMessage);
     } finally {
       setIsGenerating(false);
     }
   };
 
   const togglePromptExpanded = (sceneId: string) => {
     setExpandedPrompts(prev => ({
       ...prev,
       [sceneId]: !prev[sceneId],
     }));
   };
 
   const handleLocalEdit = (sceneId: string, field: keyof SceneEdits, value: string) => {
     setSceneEdits(prev => ({
       ...prev,
       [sceneId]: {
         ...prev[sceneId],
         [field]: value,
       },
     }));
   };
 
   const getEditedValue = (scene: Scene, field: keyof SceneEdits): string => {
     const edit = sceneEdits[scene.id]?.[field];
     if (edit !== undefined) return edit;
     return scene[field] as string;
   };
 
   const hasUnsavedChanges = (sceneId: string): boolean => {
     return !!sceneEdits[sceneId] && Object.keys(sceneEdits[sceneId]).length > 0;
   };
 
   const handleSaveChanges = async (sceneId: string) => {
     const edits = sceneEdits[sceneId];
     if (!edits || !projectId) return;
 
     setSavingSceneId(sceneId);
     try {
       await updateScene.mutateAsync({
         id: sceneId,
         projectId,
         updates: edits,
       });
       
       setSceneEdits(prev => {
         const next = { ...prev };
         delete next[sceneId];
         return next;
       });
       
       toast.success('Scene saved');
     } catch (error) {
       toast.error('Failed to save scene');
     } finally {
       setSavingSceneId(null);
     }
   };
 
   const handleDeleteScene = async (sceneId: string) => {
     if (!projectId || !scenes) return;
 
     try {
       await deleteScene.mutateAsync({ id: sceneId, projectId });
       
       const remainingScenes = scenes
         .filter(s => s.id !== sceneId)
         .sort((a, b) => a.scene_number - b.scene_number)
         .map((s, idx) => ({ id: s.id, scene_number: idx + 1 }));
       
       if (remainingScenes.length > 0) {
         await renumberScenes.mutateAsync({ projectId, sceneUpdates: remainingScenes });
       }
       
       toast.success('Scene deleted');
     } catch (error) {
       toast.error('Failed to delete scene');
     }
   };
 
   const handleSplitScene = async (scene: Scene) => {
     if (!projectId || !scenes) return;
 
     try {
       const midTime = (scene.start_time + scene.end_time) / 2;
       
       await updateScene.mutateAsync({
         id: scene.id,
         projectId,
         updates: { end_time: midTime },
       });
       
         await createScene.mutateAsync({
           project_id: projectId,
           scene_number: scene.scene_number + 1,
           start_time: midTime,
           end_time: scene.end_time,
           lyric_snippet: scene.lyric_snippet,
           scene_description: scene.scene_description,
           characters_in_scene: scene.characters_in_scene,
           shot_type: scene.shot_type,
           image_prompt: scene.image_prompt,
           animation_prompt: scene.animation_prompt,
           image_url: null,
           image_status: 'pending',
           image_approved: false,
           video_url: null,
           video_status: 'pending',
           video_request_id: null,
           video_error: null,
         });
       
       const scenesAfter = scenes
         .filter(s => s.scene_number > scene.scene_number)
         .map(s => ({ id: s.id, scene_number: s.scene_number + 1 }));
       
       if (scenesAfter.length > 0) {
         await renumberScenes.mutateAsync({ projectId, sceneUpdates: scenesAfter });
       }
       
       toast.success('Scene split');
     } catch (error) {
       toast.error('Failed to split scene');
     }
   };
 
   const handleCombineWithNext = async (scene: Scene) => {
     if (!projectId || !scenes) return;
 
     const nextScene = scenes.find(s => s.scene_number === scene.scene_number + 1);
     if (!nextScene) {
       toast.error('No next scene to combine with');
       return;
     }
 
     try {
       await updateScene.mutateAsync({
         id: scene.id,
         projectId,
         updates: {
           end_time: nextScene.end_time,
           lyric_snippet: `${scene.lyric_snippet} ${nextScene.lyric_snippet}`,
           scene_description: `${scene.scene_description} ${nextScene.scene_description}`,
           image_prompt: scene.image_prompt,
           animation_prompt: `${scene.animation_prompt} ${nextScene.animation_prompt}`,
         },
       });
       
       await deleteScene.mutateAsync({ id: nextScene.id, projectId });
       
       const remainingScenes = scenes
         .filter(s => s.id !== nextScene.id)
         .sort((a, b) => a.scene_number - b.scene_number)
         .map((s, idx) => ({ id: s.id, scene_number: idx + 1 }));
       
       await renumberScenes.mutateAsync({ projectId, sceneUpdates: remainingScenes });
       
       toast.success('Scenes combined');
     } catch (error) {
       toast.error('Failed to combine scenes');
     }
    };

    const handleAddScene = async (position: 'above' | 'below', referenceScene: Scene) => {
      if (!projectId || !scenes) return;

      try {
        const newSceneNumber = position === 'above' 
          ? referenceScene.scene_number 
          : referenceScene.scene_number + 1;

        // Calculate timing - use a small duration around the reference point
        const duration = 5; // 5 seconds default for new scene
        let startTime: number;
        let endTime: number;

        if (position === 'above') {
          // Insert before: take time from the start of reference scene
          endTime = referenceScene.start_time;
          startTime = Math.max(0, endTime - duration);
        } else {
          // Insert after: take time from the end of reference scene
          startTime = referenceScene.end_time;
          endTime = startTime + duration;
        }

        // Renumber scenes that come after the insertion point
        const scenesToRenumber = scenes
          .filter(s => s.scene_number >= newSceneNumber)
          .map(s => ({ id: s.id, scene_number: s.scene_number + 1 }));

        if (scenesToRenumber.length > 0) {
          await renumberScenes.mutateAsync({ projectId, sceneUpdates: scenesToRenumber });
        }

        // Create the new scene
        await createScene.mutateAsync({
          project_id: projectId,
          scene_number: newSceneNumber,
          start_time: startTime,
          end_time: endTime,
          lyric_snippet: '',
          scene_description: 'New scene - add description',
          characters_in_scene: [],
          shot_type: 'medium',
          image_prompt: '',
          animation_prompt: '',
          image_url: null,
          image_status: 'pending',
          image_approved: false,
          video_url: null,
          video_status: 'pending',
          video_request_id: null,
          video_error: null,
        });

        toast.success(`Scene added ${position} Scene ${referenceScene.scene_number}`);
      } catch (error) {
        toast.error('Failed to add scene');
      }
    };

    const handleContinue = async () => {
      if (!projectId) return;
      await updateProject.mutateAsync({
        id: projectId,
        updates: { status: 'images' },
      });
      navigate(`/project/${projectId}/images`);
    };
 
   const totalScenes = scenes?.length || 0;
   const totalDuration = scenes?.reduce((acc, s) => acc + (s.end_time - s.start_time), 0) || 0;
 
   if (isLoading) {
     return (
       <div className="max-w-4xl mx-auto animate-pulse space-y-6">
         <div className="h-8 bg-muted rounded w-1/3" />
         <div className="space-y-4">
           {[1, 2, 3].map((i) => (
             <div key={i} className="h-48 bg-muted rounded" />
           ))}
         </div>
       </div>
     );
   }
 
   return (
     <div className="max-w-4xl mx-auto animate-fade-in space-y-8">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-2xl font-semibold tracking-tight text-foreground">
             Storyboard
           </h1>
           <p className="text-sm text-muted-foreground mt-1">
             Plan each scene of your animated video
           </p>
         </div>
         <div className="flex gap-2">
           {scenes && scenes.length > 0 && (
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button
                   variant="outline"
                   size="sm"
                   disabled={isGenerating || !project?.timestamps?.length}
                   className="gap-2"
                 >
                   <RefreshCw className="h-4 w-4" />
                   Regenerate All
                 </Button>
               </AlertDialogTrigger>
               <AlertDialogContent>
                 <AlertDialogHeader>
                   <AlertDialogTitle>Regenerate Storyboard?</AlertDialogTitle>
                   <AlertDialogDescription>
                     This will delete all existing scenes and generate a fresh storyboard.
                   </AlertDialogDescription>
                 </AlertDialogHeader>
                 <AlertDialogFooter>
                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                   <AlertDialogAction onClick={handleGenerateStoryboard}>
                     Regenerate
                   </AlertDialogAction>
                 </AlertDialogFooter>
               </AlertDialogContent>
             </AlertDialog>
           )}
           <Button
             onClick={handleGenerateStoryboard}
             disabled={isGenerating || !project?.timestamps?.length}
             className="gap-2"
           >
             {isGenerating ? (
               <Loader2 className="h-4 w-4 animate-spin" />
             ) : (
               <Wand2 className="h-4 w-4" />
             )}
             {isGenerating ? 'Generating...' : 'Generate Storyboard'}
           </Button>
         </div>
       </div>
 
       {scenes && scenes.length > 0 && (
         <div className="flex gap-6 py-3 px-4 bg-muted/50 rounded-md text-sm">
           <div className="flex items-center gap-2">
             <Film className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{totalScenes} scenes</span>
           </div>
           <div className="flex items-center gap-2">
             <Clock className="h-4 w-4 text-muted-foreground" />
             <span className="font-medium">{formatDuration(totalDuration)} total</span>
           </div>
         </div>
       )}
 
       {!project?.timestamps?.length && (
         <Card className="border border-warning/30 bg-warning/5">
           <CardContent className="py-4">
             <p className="text-sm text-warning-foreground">
               Please complete the Project Setup step first to add timestamps.
             </p>
           </CardContent>
         </Card>
       )}
 
        {scenes && scenes.length > 0 ? (
          <div className="space-y-3">
            {scenes.map((scene, index) => (
              <div key={scene.id}>
                {/* Add Scene Above - first scene only */}
                {index === 0 && (
                  <div className="flex justify-center py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddScene('above', scene)}
                      className="text-xs text-muted-foreground hover:text-foreground h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Scene Above
                    </Button>
                  </div>
                )}

                <Card className="border">
                  {/* Card Header */}
                  <CardHeader className="p-4 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Scene {scene.scene_number}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatTime(scene.start_time)} – {formatTime(scene.end_time)}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSplitScene(scene)} title="Split">
                          <Scissors className="h-3.5 w-3.5" />
                        </Button>
                        {scenes.find(s => s.scene_number === scene.scene_number + 1) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCombineWithNext(scene)} title="Combine">
                            <Merge className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Scene?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete Scene {scene.scene_number}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteScene(scene.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="p-4 space-y-4">
                    {/* Lyric snippet */}
                    <p className="text-sm text-muted-foreground italic">
                      "{scene.lyric_snippet}"
                    </p>

                    {/* Image + Description row */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => navigate(`/project/${projectId}/images`)}
                        className="w-20 h-20 flex-shrink-0 rounded border bg-muted/30 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        {scene.image_url ? (
                          <img src={scene.image_url} alt={`Scene ${scene.scene_number}`} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </button>
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Scene Description</Label>
                        <Textarea
                          value={getEditedValue(scene, 'scene_description')}
                          onChange={(e) => handleLocalEdit(scene.id, 'scene_description', e.target.value)}
                          placeholder="Describe what happens in this scene..."
                          className="min-h-[72px] text-sm"
                        />
                      </div>
                    </div>

                    {/* Shot + Characters row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        <Select
                          value={sceneEdits[scene.id]?.shot_type ?? scene.shot_type}
                          onValueChange={(value) => handleLocalEdit(scene.id, 'shot_type', value as ShotType)}
                        >
                          <SelectTrigger className="h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SHOT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {scene.characters_in_scene.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Characters:</span>
                          <div className="flex flex-wrap gap-1">
                            {scene.characters_in_scene.map((charName, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs h-6">{charName}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Prompts collapsible */}
                    <Collapsible
                      open={expandedPrompts[scene.id]}
                      onOpenChange={() => togglePromptExpanded(scene.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="px-0 h-8 hover:bg-transparent">
                          {expandedPrompts[scene.id] ? <ChevronUp className="h-3.5 w-3.5 mr-1.5" /> : <ChevronDown className="h-3.5 w-3.5 mr-1.5" />}
                          <span className="text-xs font-medium">Show Prompts</span>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Image Prompt</Label>
                          <Textarea
                            value={getEditedValue(scene, 'image_prompt')}
                            onChange={(e) => handleLocalEdit(scene.id, 'image_prompt', e.target.value)}
                            className="min-h-[72px] text-sm"
                          />
                          <PromptFeedback
                            currentPrompt={getEditedValue(scene, 'image_prompt')}
                            sceneDescription={scene.scene_description}
                            promptType="image"
                            shotType={sceneEdits[scene.id]?.shot_type ?? scene.shot_type}
                            onRewrite={(newPrompt) => {
                              handleLocalEdit(scene.id, 'image_prompt', newPrompt);
                              if (projectId) {
                                updateScene.mutateAsync({ id: scene.id, projectId, updates: { image_prompt: newPrompt } });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Animation Prompt</Label>
                          <Textarea
                            value={getEditedValue(scene, 'animation_prompt')}
                            onChange={(e) => handleLocalEdit(scene.id, 'animation_prompt', e.target.value)}
                            className="min-h-[72px] text-sm"
                          />
                          <PromptFeedback
                            currentPrompt={getEditedValue(scene, 'animation_prompt')}
                            sceneDescription={scene.scene_description}
                            promptType="animation"
                            shotType={sceneEdits[scene.id]?.shot_type ?? scene.shot_type}
                            onRewrite={(newPrompt) => {
                              handleLocalEdit(scene.id, 'animation_prompt', newPrompt);
                              if (projectId) {
                                updateScene.mutateAsync({ id: scene.id, projectId, updates: { animation_prompt: newPrompt } });
                              }
                            }}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Save button */}
                    {hasUnsavedChanges(scene.id) && (
                      <Button
                        onClick={() => handleSaveChanges(scene.id)}
                        disabled={savingSceneId === scene.id}
                        className="h-9"
                      >
                        {savingSceneId === scene.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Save Changes
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Add Scene Below */}
                <div className="flex justify-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddScene('below', scene)}
                    className="text-xs text-muted-foreground hover:text-foreground h-8"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Scene Below
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Wand2 className="h-10 w-10 text-muted-foreground/30 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-2">
                No scenes yet
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Click "Generate Storyboard" to create scenes from your lyrics.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleContinue}
            disabled={!scenes || scenes.length === 0}
            className="h-10"
          >
            Continue to Image Generation
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }