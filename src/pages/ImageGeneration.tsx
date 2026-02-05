import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useScenes, useUpdateScene } from '@/hooks/useScenes';
import { useScenesRealtime } from '@/hooks/useScenesRealtime';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SceneCard } from '@/components/image-generation/SceneCard';
import type { ShotType } from '@/types/database';

export default function ImageGeneration() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const updateScene = useUpdateScene();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

  // Enable realtime updates and get refetch function
  const { refetchScenes } = useScenesRealtime(projectId);

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generatingAll, setGeneratingAll] = useState(false);
  const toastShownRef = useRef<Set<string>>(new Set());
  const cancelAllRef = useRef(false);

  useEffect(() => {
    setCurrentPage('Image Generation');
    setProjectData({ project, scenes });
  }, [setCurrentPage, setProjectData, project, scenes]);

  // Watch for scene status changes to show toast and clear generating state
  useEffect(() => {
    if (!scenes) return;

    scenes.forEach((scene) => {
      const isGeneratingThis = generatingIds.has(scene.id);
      if (!isGeneratingThis) return;

      if (scene.image_status === 'done') {
        const toastKey = `${scene.id}:done`;
        if (!toastShownRef.current.has(toastKey)) {
          toastShownRef.current.add(toastKey);
          toast.success(`Scene ${scene.scene_number} image generated`);
        }
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(scene.id);
          return next;
        });
      }

      if (scene.image_status === 'failed') {
        const toastKey = `${scene.id}:failed`;
        if (!toastShownRef.current.has(toastKey)) {
          toastShownRef.current.add(toastKey);
          toast.error(`Scene ${scene.scene_number} failed to generate`);
        }
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
    toastShownRef.current.delete(`${sceneId}:done`);
    toastShownRef.current.delete(`${sceneId}:failed`);
  }, []);

  // Count approved scenes (not just "done" status)
  const approvedCount = scenes?.filter((s) => s.image_approved).length || 0;
  const totalCount = scenes?.length || 0;
  const allApproved = approvedCount === totalCount && totalCount > 0;

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const fetchSceneStatus = async (sceneId: string) => {
    const { data, error } = await supabase
      .from('scenes')
      .select('image_status, image_url, scene_number')
      .eq('id', sceneId)
      .single();

    if (error) throw error;
    return data as { image_status: string; image_url: string | null; scene_number: number };
  };

  const isNetworkishInvokeError = (message: string | undefined) => {
    const m = (message || '').toLowerCase();
    return (
      m.includes('failed to send a request') ||
      m.includes('failed to fetch') ||
      m.includes('networkerror')
    );
  };

  const generateImage = async (sceneId: string) => {
    // Clear any previous toast tracking for this scene
    clearToastTracking(sceneId);
    setGeneratingIds((prev) => new Set(prev).add(sceneId));

    const requestPayload = { scene_id: sceneId };

    const clearGeneratingFlag = () => {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    };

    const verifyIfGenerationStartedOrFinished = async () => {
      // If the request reached the backend but the response got dropped,
      // the DB will show generating/done shortly after.
      for (let attempt = 0; attempt < 4; attempt++) {
        await sleep(1200 + attempt * 800);
        try {
          const statusRow = await fetchSceneStatus(sceneId);
          if (statusRow.image_status === 'generating' || statusRow.image_status === 'done') {
            return statusRow;
          }
        } catch {
          // Ignore status fetch errors; we’ll fall back to showing an error.
        }
      }
      return null;
    };

    try {
      console.log('Generating scene image:', requestPayload);

      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: requestPayload,
      });

      if (error) {
        console.error('Edge function error:', error);
        logApiCall('Generate Scene Image', requestPayload, { error: error.message });

        if (isNetworkishInvokeError(error.message)) {
          const statusRow = await verifyIfGenerationStartedOrFinished();
          if (statusRow) {
            // If done, clear generating flag so button re-enables.
            // If still generating, realtime/refetch will handle it.
            if (statusRow.image_status === 'done') {
              clearGeneratingFlag();
            }
            toast.info(`Connection hiccup — scene ${statusRow.scene_number} is ${statusRow.image_status}.`);
            return;
          }
        }

        toast.error(`Failed to generate image: ${error.message}`);
        clearGeneratingFlag();
        return;
      }

      logApiCall('Generate Scene Image', requestPayload, data);
      // Success will be handled by the useEffect watching scenes
    } catch (err) {
      console.error('Unexpected error:', err);

      const message = err instanceof Error ? err.message : undefined;
      if (isNetworkishInvokeError(message)) {
        const statusRow = await verifyIfGenerationStartedOrFinished();
        if (statusRow) {
          if (statusRow.image_status === 'done') {
            clearGeneratingFlag();
          }
          toast.info(`Connection hiccup — scene ${statusRow.scene_number} is ${statusRow.image_status}.`);
          return;
        }
        toast.error('Network error while starting generation. Please retry.');
      } else {
        toast.error('An unexpected error occurred');
      }

      clearGeneratingFlag();
    }
  };

  const handleGenerateAll = async () => {
    if (!scenes) return;
    
    cancelAllRef.current = false;
    setGeneratingAll(true);

    const pendingScenes = scenes.filter(
      (s) => s.image_status !== 'done' && s.image_status !== 'generating'
    );

    // Generate sequentially with cancellation check
    for (const scene of pendingScenes) {
      if (cancelAllRef.current) {
        toast.info('Batch generation cancelled');
        break;
      }
      await generateImage(scene.id);
    }

    setGeneratingAll(false);
    cancelAllRef.current = false;
  };

  const handleCancelAll = () => {
    cancelAllRef.current = true;
    toast.info('Cancelling after current image completes...');
  };

  const handleApprovalChange = async (sceneId: string, approved: boolean) => {
    if (!projectId) return;
    
    try {
      await updateScene.mutateAsync({
        id: sceneId,
        projectId,
        updates: { image_approved: approved },
      });
    } catch (error) {
      toast.error('Failed to update approval');
    }
  };

  const handlePromptSave = async (sceneId: string, updates: { image_prompt?: string; shot_type?: ShotType }) => {
    if (!projectId) return;
    
    await updateScene.mutateAsync({
      id: sceneId,
      projectId,
      updates,
    });
    toast.success('Prompt saved');
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
            {approvedCount} / {totalCount} approved
          </div>
          <Progress value={(approvedCount / totalCount) * 100} className="w-32" />
          {generatingAll ? (
            <Button
              onClick={handleCancelAll}
              variant="destructive"
              className="gap-2"
            >
              Cancel All
            </Button>
          ) : (
            <Button
              onClick={handleGenerateAll}
              disabled={generatingIds.size > 0}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Generate All
            </Button>
          )}
        </div>
      </div>

      {scenes && scenes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              isGenerating={generatingIds.has(scene.id)}
              generatingAll={generatingAll}
              onGenerate={() => generateImage(scene.id)}
              onApprovalChange={(approved) => handleApprovalChange(scene.id, approved)}
              onPromptSave={(updates) => handlePromptSave(scene.id, updates)}
            />
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
          disabled={!allApproved}
          className="gap-2"
        >
          Continue to Video Generation
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
