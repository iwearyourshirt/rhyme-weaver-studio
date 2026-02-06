import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, Video, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useScenes, useUpdateScene } from '@/hooks/useScenes';
import { useScenesRealtime } from '@/hooks/useScenesRealtime';
import { useDebug } from '@/contexts/DebugContext';
import { VideoSceneCard } from '@/components/video-generation/VideoSceneCard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const COST_PER_VIDEO = 0.24; // LTX Video 2.0 Fast: $0.04/sec × 6 seconds
const VIDEO_MODEL_ENDPOINT = "fal-ai/ltx-2/image-to-video/fast";
const POLL_INTERVAL = 5000; // 5 seconds - LTX is much faster than Kling

export default function VideoGeneration() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const updateScene = useUpdateScene();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall, updateVideoSceneStatus, setVideoModel } = useDebug();

  // Enable realtime updates and get refetch function
  const { refetchScenes } = useScenesRealtime(projectId);

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isCancellingAll, setIsCancellingAll] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const toastShownRef = useRef<Set<string>>(new Set());
  const generationStartTimesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setCurrentPage('Video Generation');
    setProjectData({ project, scenes });
    setVideoModel(VIDEO_MODEL_ENDPOINT);
    
    // Initialize scene statuses in debug context
    if (scenes) {
      scenes.forEach((scene) => {
        updateVideoSceneStatus({
          sceneNumber: scene.scene_number,
          sceneId: scene.id,
          status: scene.video_status as 'pending' | 'generating' | 'done' | 'failed',
          requestId: scene.video_request_id || undefined,
          videoUrl: scene.video_url || undefined,
          error: scene.video_error || undefined,
        });
      });
    }
  }, [setCurrentPage, setProjectData, project, scenes, setVideoModel, updateVideoSceneStatus]);

  // Calculate progress
  const doneCount = scenes?.filter((s) => s.video_status === 'done').length || 0;
  const generatingCount = scenes?.filter((s) => s.video_status === 'generating').length || 0;
  const totalCount = scenes?.length || 0;
  const readyToGenerateCount = scenes?.filter(
    (s) => s.image_status === 'done' && s.image_url && s.video_status !== 'done'
  ).length || 0;
  const allDone = doneCount === totalCount && totalCount > 0;

  // Fallback: refetch scenes from DB every 8s while any are generating
  // This catches cases where Realtime misses updates (channel errors)
  useEffect(() => {
    const hasGenerating = scenes?.some((s) => s.video_status === 'generating');
    if (!hasGenerating) return;

    const interval = setInterval(() => {
      console.log('[Video poll fallback] Refetching scenes from DB...');
      refetchScenes();
    }, 8000);

    return () => clearInterval(interval);
  }, [scenes?.filter((s) => s.video_status === 'generating').length, refetchScenes]);

  // Calculate estimated cost
  const estimatedCost = (readyToGenerateCount * COST_PER_VIDEO).toFixed(2);

  // Poll for video status updates
  const pollVideoStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const response = await supabase.functions.invoke('poll-video-status', {
        body: { project_id: projectId },
      });

      if (response.error) {
        console.error('Poll error:', response.error);
        return;
      }

      const data = response.data;
      logApiCall('Poll Video Status', { project_id: projectId }, data);

      // Show toasts and update debug context for completed videos
      if (data.updates && data.updates.length > 0) {
        // Force immediate refetch to update UI
        refetchScenes();
        
        for (const update of data.updates) {
          const generationEndTime = Date.now();
          const startTime = generationStartTimesRef.current.get(update.scene_id);
          
          if (update.status === 'done' && !toastShownRef.current.has(update.scene_id)) {
            toastShownRef.current.add(update.scene_id);
            toast.success(`Scene ${update.scene_number} video generated!`);
            
            // Update debug context with completion info
            updateVideoSceneStatus({
              sceneNumber: update.scene_number,
              sceneId: update.scene_id,
              status: 'done',
              videoUrl: update.video_url,
              generationStartTime: startTime,
              generationEndTime,
            });
            
            generationStartTimesRef.current.delete(update.scene_id);
          } else if (update.status === 'failed' && !toastShownRef.current.has(update.scene_id)) {
            toastShownRef.current.add(update.scene_id);
            toast.error(`Scene ${update.scene_number} failed: ${update.error || 'Unknown error'}`);
            
            // Update debug context with failure info
            updateVideoSceneStatus({
              sceneNumber: update.scene_number,
              sceneId: update.scene_id,
              status: 'failed',
              error: update.error,
              generationStartTime: startTime,
              generationEndTime,
            });
            
            generationStartTimesRef.current.delete(update.scene_id);
          }
        }
      }
    } catch (error) {
      console.error('Error polling video status:', error);
    }
  }, [projectId, logApiCall, updateVideoSceneStatus, refetchScenes]);

  // Start/stop polling based on generating scenes
  useEffect(() => {
    const hasGenerating = scenes?.some((s) => s.video_status === 'generating');

    if (hasGenerating && !pollIntervalRef.current) {
      // Start polling
      pollIntervalRef.current = setInterval(pollVideoStatus, POLL_INTERVAL);
      // Also poll immediately
      pollVideoStatus();
    } else if (!hasGenerating && pollIntervalRef.current) {
      // Stop polling
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [scenes, pollVideoStatus]);

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const isNetworkishInvokeError = (message: string | undefined) => {
    const m = (message || '').toLowerCase();
    return (
      m.includes('failed to send a request') ||
      m.includes('failed to fetch') ||
      m.includes('networkerror')
    );
  };

  const generateVideo = async (sceneId: string) => {
    const scene = scenes?.find((s) => s.id === sceneId);
    if (!scene || !scene.image_url) return;
    
    // Prevent duplicate generation if already in progress
    if (scene.video_status === 'generating') return;

    const generationStartTime = Date.now();
    generationStartTimesRef.current.set(sceneId, generationStartTime);
    setGeneratingIds((prev) => new Set(prev).add(sceneId));
    
    // Track in debug context
    updateVideoSceneStatus({
      sceneNumber: scene.scene_number,
      sceneId: sceneId,
      status: 'generating',
      generationStartTime,
    });

    try {
      const response = await supabase.functions.invoke('generate-scene-video', {
        body: {
          scene_id: sceneId,
          project_id: projectId,
          image_url: scene.image_url,
          animation_prompt: scene.animation_prompt,
          scene_description: scene.scene_description,
          shot_type: scene.shot_type,
          animation_direction: project?.animation_direction,
        },
      });

      if (response.error) {
        console.error('Edge function error:', response.error);

        // Even on network error, the edge function may have started.
        // Wait briefly and check if status moved to "generating".
        if (isNetworkishInvokeError(response.error.message)) {
          await sleep(2000);
          try {
            const { data: statusRow } = await supabase
              .from('scenes')
              .select('video_status')
              .eq('id', sceneId)
              .single();
            if (statusRow?.video_status === 'generating' || statusRow?.video_status === 'done') {
              // Edge function started successfully despite network error — polling will handle the rest
              console.log(`Scene ${sceneId} is already generating despite network error`);
              return;
            }
          } catch { /* ignore */ }
        }

        throw new Error(response.error.message);
      }

      logApiCall('Generate Video', { scene_id: sceneId }, response.data);
      
      // Update debug with request ID
      updateVideoSceneStatus({
        sceneNumber: scene.scene_number,
        sceneId: sceneId,
        status: 'generating',
        requestId: response.data.request_id,
        generationStartTime,
      });

      // Start polling if not already
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(pollVideoStatus, POLL_INTERVAL);
      }
    } catch (error) {
      console.error('Error generating video:', error);
      toast.error(`Failed to start video generation: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Mark as failed
      await updateScene.mutateAsync({
        id: sceneId,
        projectId: projectId!,
        updates: {
          video_status: 'failed',
          video_error: error instanceof Error ? error.message : 'Failed to start generation',
        },
      });
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleGenerateAll = async () => {
    if (!scenes) return;

    const pendingScenes = scenes.filter(
      (s) => s.image_status === 'done' && s.image_url && s.video_status !== 'done' && s.video_status !== 'generating'
    );

    if (pendingScenes.length === 0) {
      toast.info('No scenes ready to generate');
      return;
    }

    setIsGeneratingAll(true);

    // Generate one at a time to avoid edge function failures
    for (const scene of pendingScenes) {
      await generateVideo(scene.id);
      // Wait for this scene to finish before starting next
      // Poll until the scene status changes from 'generating'
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max wait (5s intervals)
      while (attempts < maxAttempts) {
        await sleep(5000);
        attempts++;
        const { data: statusRow } = await supabase
          .from('scenes')
          .select('video_status')
          .eq('id', scene.id)
          .single();
        if (statusRow?.video_status === 'done' || statusRow?.video_status === 'failed') {
          refetchScenes();
          break;
        }
      }
    }

    setIsGeneratingAll(false);
    toast.success('All video generations complete');
  };

  const handleCancelAll = async () => {
    if (!scenes) return;
    
    const generatingScenes = scenes.filter((s) => s.video_status === 'generating');
    
    if (generatingScenes.length === 0) {
      toast.info('No videos currently generating');
      return;
    }

    setIsCancellingAll(true);
    
    // Cancel all generating videos in parallel
    const cancelPromises = generatingScenes.map((scene) => cancelVideoGeneration(scene.id));
    await Promise.all(cancelPromises);
    
    setIsCancellingAll(false);
    toast.success(`Cancelled ${generatingScenes.length} video generations`);
  };

  const handleUpdatePrompt = async (sceneId: string, newPrompt: string) => {
    await updateScene.mutateAsync({
      id: sceneId,
      projectId: projectId!,
      updates: { animation_prompt: newPrompt },
    });
  };

  const cancelVideoGeneration = async (sceneId: string) => {
    const scene = scenes?.find((s) => s.id === sceneId);
    if (!scene) return;

    setCancellingIds((prev) => new Set(prev).add(sceneId));

    try {
      const response = await supabase.functions.invoke('cancel-video-generation', {
        body: {
          scene_id: sceneId,
          request_id: scene.video_request_id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      logApiCall('Cancel Video Generation', { scene_id: sceneId }, response.data);
      toast.success(`Scene ${scene.scene_number} generation cancelled`);

      // Update debug context
      updateVideoSceneStatus({
        sceneNumber: scene.scene_number,
        sceneId: sceneId,
        status: 'pending',
      });

      // Clear from toast shown ref so it can show again if regenerated
      toastShownRef.current.delete(sceneId);
      generationStartTimesRef.current.delete(sceneId);
    } catch (error) {
      console.error('Error cancelling video:', error);
      toast.error(`Failed to cancel: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  const handleContinue = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({
      id: projectId,
      updates: { status: 'export' },
    });
    navigate(`/project/${projectId}/export`);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Video Generation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Animate each scene with gentle, dreamlike motion
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-xs text-muted-foreground font-mono">
            {doneCount}/{totalCount} complete
            {generatingCount > 0 && ` (${generatingCount} generating)`}
          </div>
          <Progress value={(doneCount / totalCount) * 100} className="w-24 h-1.5" />
        </div>
      </div>

      {/* Cost Estimate & Generate All */}
      {readyToGenerateCount > 0 && (
        <Card className="border border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">
                  {readyToGenerateCount} scenes ready to generate
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {readyToGenerateCount} × ${COST_PER_VIDEO} = ${estimatedCost} estimated
                </p>
              </div>
            </div>
            {generatingCount > 0 ? (
              <Button
                onClick={handleCancelAll}
                disabled={isCancellingAll}
                variant="destructive"
                size="sm"
              >
                {isCancellingAll ? 'Cancelling...' : 'Cancel All'}
              </Button>
            ) : (
              <Button
                onClick={handleGenerateAll}
                disabled={isGeneratingAll}
                size="sm"
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Generate All Videos
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scene Grid */}
      {scenes && scenes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {scenes.map((scene) => (
            <VideoSceneCard
              key={scene.id}
              scene={scene}
              projectId={projectId!}
              isGenerating={generatingIds.has(scene.id) || scene.video_status === 'generating'}
              anyGenerating={generatingCount > 0 || isGeneratingAll}
              isCancelling={cancellingIds.has(scene.id)}
              onGenerate={() => generateVideo(scene.id)}
              onCancel={() => cancelVideoGeneration(scene.id)}
              onUpdatePrompt={(prompt) => handleUpdatePrompt(scene.id, prompt)}
              onUpdateShotType={async (shotType) => {
                await updateScene.mutateAsync({
                  id: scene.id,
                  projectId: projectId!,
                  updates: { shot_type: shotType }
                });
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Video className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium text-foreground mb-2">
              No scenes yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Complete the Image Generation step first.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!allDone}
          className="gap-2"
        >
          Continue to Export
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
