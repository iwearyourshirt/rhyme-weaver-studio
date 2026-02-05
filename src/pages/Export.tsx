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
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">
          Export
        </h1>
        <p className="text-muted-foreground mt-1">
          Download your video clips and audio
        </p>
      </div>

      <Card className="card-shadow border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">
                Ready to Assemble
              </h3>
              <p className="text-sm text-muted-foreground">
                Import these clips and audio into Descript, CapCut, or your preferred
                video editor to assemble the final video. The clips are already in
                order and match the timestamps of your audio.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Clips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2">
              {scenes?.map((scene) => (
                <div
                  key={scene.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div className="w-16 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
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
                    <p className="text-xs text-muted-foreground">
                      {formatTime(scene.start_time)} - {formatTime(scene.end_time)}
                    </p>
                  </div>
                  {scene.video_status === 'done' && (
                    <div className="h-2 w-2 rounded-full bg-success" />
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

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
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

      <Card className="card-shadow">
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {scenes?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Scenes</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {scenes?.filter((s) => s.image_status === 'done').length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Images</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {scenes?.filter((s) => s.video_status === 'done').length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Videos</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">
                {scenes?.length
                  ? formatTime(scenes[scenes.length - 1]?.end_time || 0)
                  : '0:00'}
              </p>
              <p className="text-sm text-muted-foreground">Duration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}