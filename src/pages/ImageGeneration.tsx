 import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, RefreshCw, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useScenes, useUpdateScene } from '@/hooks/useScenes';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';
 import { supabase } from '@/integrations/supabase/client';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ImageGeneration() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const updateScene = useUpdateScene();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

   const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
   const [generatingAll, setGeneratingAll] = useState(false);
   const toastShownRef = useRef<Set<string>>(new Set());

   useEffect(() => {
     setCurrentPage('Image Generation');
     setProjectData({ project, scenes });
   }, [setCurrentPage, setProjectData, project, scenes]);
 
   // Watch for scene status changes to show toast and clear generating state
   useEffect(() => {
     if (!scenes) return;
 
     scenes.forEach((scene) => {
       // If scene is now done and we were generating it
       if (scene.image_status === 'done' && generatingIds.has(scene.id)) {
         // Only show toast once per scene completion
         if (!toastShownRef.current.has(scene.id)) {
           toastShownRef.current.add(scene.id);
           toast.success(`Scene ${scene.scene_number} image generated`);
         }
         // Clear from generating set
         setGeneratingIds((prev) => {
           const next = new Set(prev);
           next.delete(scene.id);
           return next;
         });
       }
     });
   }, [scenes, generatingIds]);
 
   // Reset toast tracking when starting new generations
   const clearToastTracking = useCallback((sceneId: string) => {
     toastShownRef.current.delete(sceneId);
   }, []);

   const doneCount = scenes?.filter((s) => s.image_status === 'done').length || 0;
  const totalCount = scenes?.length || 0;
   const allDone = doneCount === totalCount && totalCount > 0;

   const generateImage = async (sceneId: string) => {
     // Clear any previous toast tracking for this scene
     clearToastTracking(sceneId);
     setGeneratingIds((prev) => new Set(prev).add(sceneId));
 
     try {
       const requestPayload = { scene_id: sceneId };
       
       // Log the request to debug panel
       console.log('Generating scene image:', requestPayload);
       
       const { data, error } = await supabase.functions.invoke('generate-scene-image', {
         body: requestPayload,
       });
       
       if (error) {
         console.error('Edge function error:', error);
         logApiCall('Generate Scene Image', requestPayload, { error: error.message });
         toast.error(`Failed to generate image: ${error.message}`);
         // Only clear generating on error - success is handled by the effect watching scene status
         setGeneratingIds((prev) => {
           const next = new Set(prev);
           next.delete(sceneId);
           return next;
         });
       } else {
         logApiCall('Generate Scene Image', requestPayload, data);
         // Don't show success toast here - wait for database to confirm completion
         // The useEffect watching scenes will handle the toast when image_status becomes 'done'
       }
     } catch (err) {
       console.error('Unexpected error:', err);
       toast.error('An unexpected error occurred');
       setGeneratingIds((prev) => {
         const next = new Set(prev);
         next.delete(sceneId);
         return next;
       });
     }
   };

  const handleGenerateAll = async () => {
    if (!scenes) return;
     
     setGeneratingAll(true);

    const pendingScenes = scenes.filter(
       (s) => s.image_status !== 'done' && s.image_status !== 'generating'
    );

     // Generate sequentially (one at a time)
    for (const scene of pendingScenes) {
      await generateImage(scene.id);
    }

     setGeneratingAll(false);
     // Don't show "all done" toast here - individual scene toasts handle success
  };

  const handleContinue = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({
      id: projectId,
      updates: { status: 'videos' },
    });
    navigate(`/project/${projectId}/videos`);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Image Generation
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate images for each scene
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
             {doneCount} / {totalCount} complete
          </div>
           <Progress value={(doneCount / totalCount) * 100} className="w-32" />
          <Button
            onClick={handleGenerateAll}
             disabled={generatingIds.size > 0 || generatingAll || allDone}
            className="gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Generate All
          </Button>
        </div>
      </div>

      {scenes && scenes.length > 0 ? (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className="card-shadow overflow-hidden group"
            >
               <div className="aspect-[3/2] bg-muted relative">
                {scene.image_url ? (
                  <img
                    src={scene.image_url}
                    alt={`Scene ${scene.scene_number}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
                {generatingIds.has(scene.id) && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Scene {scene.scene_number}
                  </span>
                  <StatusBadge status={scene.image_status} />
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                </p>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 italic">
                  "{scene.lyric_snippet}"
                </p>
                <Button
                  size="sm"
                   variant={scene.image_status === 'done' ? 'outline' : 'default'}
                  className="w-full gap-1.5"
                  onClick={() => generateImage(scene.id)}
                   disabled={generatingIds.has(scene.id) || generatingAll}
                >
                   {scene.image_status === 'done' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No scenes yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Complete the Storyboard step first to generate scenes.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleContinue}
           disabled={!allDone}
          className="gap-2"
        >
          Continue to Video Generation
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}