 import { useEffect, useState } from 'react';
 import { useParams, useNavigate } from 'react-router-dom';
 import { ArrowRight, Wand2, GripVertical, ChevronDown, ChevronUp, Scissors, Merge, Trash2, Save, Loader2, Clock, Film, RefreshCw, ImageIcon } from 'lucide-react';
 import { Button } from '@/components/ui/button';
  import { Label } from '@/components/ui/label';
  import { PromptFeedback } from '@/components/storyboard/PromptFeedback';
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
 }
 
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
       
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-storyboard`,
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
         throw new Error(data.error || 'Storyboard generation failed');
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
     <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
       <div className="flex items-center justify-between">
         <div>
           <h1 className="text-3xl font-display font-bold text-foreground">
             Storyboard
           </h1>
           <p className="text-muted-foreground mt-1">
             Plan each scene of your animated video
           </p>
         </div>
         <div className="flex gap-2">
           {scenes && scenes.length > 0 && (
             <AlertDialog>
               <AlertDialogTrigger asChild>
                 <Button
                   variant="outline"
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
                     This will delete all existing scenes and generate a fresh storyboard. Any edits you've made will be lost.
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
             {isGenerating ? 'Generating (30-60s)...' : 'Generate Storyboard'}
           </Button>
         </div>
       </div>
 
       {scenes && scenes.length > 0 && (
         <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
           <div className="flex items-center gap-2">
             <Film className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium">{totalScenes} scenes</span>
           </div>
           <div className="flex items-center gap-2">
             <Clock className="h-4 w-4 text-muted-foreground" />
             <span className="text-sm font-medium">{formatDuration(totalDuration)} total</span>
           </div>
         </div>
       )}
 
       {!project?.timestamps?.length && (
         <Card className="card-shadow border-warning/50">
           <CardContent className="py-6">
             <p className="text-warning-foreground">
               Please complete the Project Setup step first to add timestamps.
             </p>
           </CardContent>
         </Card>
       )}
 
       {scenes && scenes.length > 0 ? (
         <div className="space-y-4">
           {scenes.map((scene) => (
             <Card key={scene.id} className="card-shadow">
               <CardHeader className="pb-2">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <GripVertical className="h-5 w-5 text-muted-foreground" />
                     <CardTitle className="text-base">
                       Scene {scene.scene_number}: {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                     </CardTitle>
                   </div>
                   <div className="flex items-center gap-1">
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => handleSplitScene(scene)}
                       title="Split Scene"
                     >
                       <Scissors className="h-4 w-4" />
                     </Button>
                     {scenes.find(s => s.scene_number === scene.scene_number + 1) && (
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => handleCombineWithNext(scene)}
                         title="Combine with Next"
                       >
                         <Merge className="h-4 w-4" />
                       </Button>
                     )}
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="sm" title="Delete Scene">
                           <Trash2 className="h-4 w-4 text-destructive" />
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
                 <p className="text-sm text-muted-foreground italic ml-8">
                   "{scene.lyric_snippet}"
                 </p>
               </CardHeader>
               <CardContent className="space-y-4 pt-2">
                 <div className="flex gap-4">
                   <div className="w-24 h-24 flex-shrink-0 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                     {scene.image_url ? (
                       <img src={scene.image_url} alt={`Scene ${scene.scene_number}`} className="w-full h-full object-cover rounded-lg" />
                     ) : (
                       <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                     )}
                   </div>
                   
                   <div className="space-y-2 flex-1">
                     <Label className="text-xs text-muted-foreground">Scene Description</Label>
                     <Textarea
                       value={getEditedValue(scene, 'scene_description')}
                       onChange={(e) => handleLocalEdit(scene.id, 'scene_description', e.target.value)}
                       placeholder="Describe what happens in this scene..."
                       className="min-h-[80px]"
                     />
                   </div>
                 </div>
 
                 {scene.characters_in_scene.length > 0 && (
                   <div className="flex items-center gap-2">
                     <Label className="text-xs text-muted-foreground">Characters:</Label>
                     <div className="flex flex-wrap gap-1">
                       {scene.characters_in_scene.map((charName, idx) => (
                         <Badge key={idx} variant="secondary" className="text-xs">
                           {charName}
                         </Badge>
                       ))}
                     </div>
                   </div>
                 )}
 
                 <Collapsible open={expandedPrompts[scene.id]} onOpenChange={() => togglePromptExpanded(scene.id)}>
                   <CollapsibleTrigger asChild>
                     <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                       {expandedPrompts[scene.id] ? (
                         <ChevronUp className="h-4 w-4" />
                       ) : (
                         <ChevronDown className="h-4 w-4" />
                       )}
                       {expandedPrompts[scene.id] ? 'Hide Prompts' : 'Show Prompts'}
                     </Button>
                   </CollapsibleTrigger>
                   <CollapsibleContent className="space-y-4 pt-2">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Image Prompt</Label>
                          <Textarea
                            value={getEditedValue(scene, 'image_prompt')}
                            onChange={(e) => handleLocalEdit(scene.id, 'image_prompt', e.target.value)}
                            placeholder="Prompt for generating the scene image..."
                            className="min-h-[100px] text-sm"
                          />
                          <PromptFeedback
                            promptType="image"
                            currentPrompt={getEditedValue(scene, 'image_prompt')}
                            sceneDescription={getEditedValue(scene, 'scene_description')}
                            onRewrite={(newPrompt) => handleLocalEdit(scene.id, 'image_prompt', newPrompt)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Animation Prompt</Label>
                          <Textarea
                            value={getEditedValue(scene, 'animation_prompt')}
                            onChange={(e) => handleLocalEdit(scene.id, 'animation_prompt', e.target.value)}
                            placeholder="Describe how this scene should animate..."
                            className="min-h-[100px] text-sm"
                          />
                          <PromptFeedback
                            promptType="animation"
                            currentPrompt={getEditedValue(scene, 'animation_prompt')}
                            sceneDescription={getEditedValue(scene, 'scene_description')}
                            onRewrite={(newPrompt) => handleLocalEdit(scene.id, 'animation_prompt', newPrompt)}
                          />
                        </div>
                     </div>
                   </CollapsibleContent>
                 </Collapsible>
 
                 {hasUnsavedChanges(scene.id) && (
                   <div className="flex justify-end pt-2 border-t">
                     <Button
                       size="sm"
                       onClick={() => handleSaveChanges(scene.id)}
                       disabled={savingSceneId === scene.id}
                       className="gap-2"
                     >
                       {savingSceneId === scene.id ? (
                         <Loader2 className="h-4 w-4 animate-spin" />
                       ) : (
                         <Save className="h-4 w-4" />
                       )}
                       Save Changes
                     </Button>
                   </div>
                 )}
               </CardContent>
             </Card>
           ))}
         </div>
       ) : (
         <Card className="card-shadow">
           <CardContent className="flex flex-col items-center justify-center py-16">
             <Wand2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
             <h3 className="text-lg font-medium text-foreground mb-2">
               No scenes yet
             </h3>
             <p className="text-muted-foreground text-center max-w-md">
               Click "Generate Storyboard" to create scenes from your lyrics.
             </p>
           </CardContent>
         </Card>
       )}
 
       <div className="flex justify-end">
         <Button
           size="lg"
           onClick={handleContinue}
           disabled={!scenes || scenes.length === 0}
           className="gap-2"
         >
           Continue to Image Generation
           <ArrowRight className="h-4 w-4" />
         </Button>
       </div>
     </div>
   );
 }