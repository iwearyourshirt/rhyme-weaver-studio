import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, RefreshCw, Video, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui/status-badge';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useScenes, useUpdateScene } from '@/hooks/useScenes';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoGeneration() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const updateScene = useUpdateScene();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCurrentPage('Video Generation');
    setProjectData({ project, scenes });
  }, [setCurrentPage, setProjectData, project, scenes]);

  const doneCount = scenes?.filter((s) => s.video_status === 'done').length || 0;
  const totalCount = scenes?.length || 0;
  const allDone = doneCount === totalCount && totalCount > 0;

  const generateVideo = async (sceneId: string) => {
    setGeneratingIds((prev) => new Set(prev).add(sceneId));

    await updateScene.mutateAsync({
      id: sceneId,
      projectId: projectId!,
      updates: { video_status: 'generating' },
    });

    // Placeholder - will connect to fal.ai later
    await new Promise((resolve) => setTimeout(resolve, 3000 + Math.random() * 2000));

    // Use a placeholder video URL (just marking as done for demo)
    const mockVideoUrl = `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4`;

    await updateScene.mutateAsync({
      id: sceneId,
      projectId: projectId!,
      updates: { video_status: 'done', video_url: mockVideoUrl },
    });

    logApiCall('Generate Video', { sceneId }, { video_url: mockVideoUrl });
    setGeneratingIds((prev) => {
      const next = new Set(prev);
      next.delete(sceneId);
      return next;
    });
  };

  const handleGenerateAll = async () => {
    if (!scenes) return;

    const pendingScenes = scenes.filter(
      (s) => s.video_status === 'pending' || s.video_status === 'failed'
    );

    for (const scene of pendingScenes) {
      await generateVideo(scene.id);
    }

    toast.success('All videos generated!');
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
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Video Generation
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate animated videos for each scene
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {doneCount} / {totalCount} complete
          </div>
          <Progress value={(doneCount / totalCount) * 100} className="w-32" />
          <Button
            onClick={handleGenerateAll}
            disabled={generatingIds.size > 0 || allDone}
            className="gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Generate All
          </Button>
        </div>
      </div>

      {scenes && scenes.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {scenes.map((scene) => (
            <Card
              key={scene.id}
              className="card-shadow overflow-hidden group"
            >
              <div className="aspect-video bg-muted relative">
                {scene.image_url ? (
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
                {scene.video_status === 'done' && (
                  <div className="absolute inset-0 bg-background/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-primary rounded-full p-3">
                      <Play className="h-6 w-6 text-primary-foreground fill-current" />
                    </div>
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
                  <StatusBadge status={scene.video_status} />
                </div>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                </p>
                <Button
                  size="sm"
                  variant={scene.video_status === 'done' ? 'outline' : 'default'}
                  className="w-full gap-1.5"
                  onClick={() => generateVideo(scene.id)}
                  disabled={generatingIds.has(scene.id) || scene.image_status !== 'done'}
                >
                  {scene.video_status === 'done' ? (
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
            <Video className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No scenes yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md">
              Complete the Image Generation step first.
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
          Continue to Export
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}