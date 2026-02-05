import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Music, Video, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProject } from '@/hooks/useProjects';
import { useScenes } from '@/hooks/useScenes';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Export() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const { setCurrentPage, setProjectData } = useDebug();

  useEffect(() => {
    setCurrentPage('Export');
    setProjectData({ project, scenes });
  }, [setCurrentPage, setProjectData, project, scenes]);

  const handleDownloadClips = () => {
    // Placeholder - will implement ZIP download later
    toast.info('ZIP download will be available soon!');
  };

  const handleDownloadAudio = () => {
    if (project?.audio_url) {
      window.open(project.audio_url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Export
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download your video clips and audio
        </p>
      </div>

      <Card className="border border-primary/20 bg-primary/5">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Ready to Assemble
              </h3>
              <p className="text-xs text-muted-foreground">
                Import these clips and audio into Descript, CapCut, or your preferred
                video editor. The clips are already in order.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video Clips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-56 overflow-y-auto space-y-2">
              {scenes?.map((scene) => (
                <div
                  key={scene.id}
                  className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                >
                  <div className="w-14 h-9 rounded overflow-hidden bg-muted flex-shrink-0">
                    {scene.image_url && (
                      <img
                        src={scene.image_url}
                        alt={`Scene ${scene.scene_number}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      Scene {scene.scene_number}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                    </p>
                  </div>
                  {scene.video_status === 'done' && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
            <Button onClick={handleDownloadClips} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download All Clips (ZIP)
            </Button>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Music className="h-4 w-4" />
              Audio Track
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project?.audio_url ? (
              <>
                <audio
                  src={project.audio_url}
                  controls
                  className="w-full"
                />
                <Button
                  onClick={handleDownloadAudio}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Audio
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No audio file uploaded
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Project Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-md bg-muted/50">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {scenes?.length || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Scenes</p>
            </div>
            <div className="p-4 rounded-md bg-muted/50">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {scenes?.filter((s) => s.image_status === 'done').length || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Images</p>
            </div>
            <div className="p-4 rounded-md bg-muted/50">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {scenes?.filter((s) => s.video_status === 'done').length || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Videos</p>
            </div>
            <div className="p-4 rounded-md bg-muted/50">
              <p className="text-2xl font-semibold text-foreground font-mono">
                {scenes?.length
                  ? formatTime(scenes[scenes.length - 1]?.end_time || 0)
                  : '0:00'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Duration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}