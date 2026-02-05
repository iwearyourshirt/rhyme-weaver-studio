import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Wand2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useCharacters } from '@/hooks/useCharacters';
import { useScenes, useBulkCreateScenes, useUpdateScene, useDeleteScenes } from '@/hooks/useScenes';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';
import type { Scene } from '@/types/database';

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function Storyboard() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: characters } = useCharacters(projectId);
  const { data: scenes, isLoading } = useScenes(projectId);
  const bulkCreateScenes = useBulkCreateScenes();
  const updateScene = useUpdateScene();
  const deleteScenes = useDeleteScenes();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setCurrentPage('Storyboard');
    setProjectData({ project, characters, scenes });
  }, [setCurrentPage, setProjectData, project, characters, scenes]);

  const handleGenerateStoryboard = async () => {
    if (!projectId || !project?.timestamps) return;

    setIsGenerating(true);

    // Clear existing scenes
    await deleteScenes.mutateAsync(projectId);

    // Placeholder - will connect to Claude API later
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const generatedScenes: Omit<Scene, 'id' | 'created_at'>[] = project.timestamps.map(
      (ts, index) => ({
        project_id: projectId,
        scene_number: index + 1,
        start_time: ts.start,
        end_time: ts.end,
        lyric_snippet: ts.text,
        scene_description: `Scene showing "${ts.text}" with animated characters`,
        characters_in_scene: characters?.slice(0, 2).map((c) => c.id) || [],
        image_prompt: `A colorful, child-friendly illustration: ${ts.text}. Cute cartoon style, warm lighting, nursery aesthetic.`,
        animation_prompt: `Gentle animation of ${ts.text}. Smooth, kid-friendly movement.`,
        image_url: null,
        image_status: 'pending',
        video_url: null,
        video_status: 'pending',
      })
    );

    await bulkCreateScenes.mutateAsync({ projectId, scenes: generatedScenes });

    logApiCall('Generate Storyboard', { projectId }, generatedScenes);
    toast.success('Storyboard generated! (Demo data)');
    setIsGenerating(false);
  };

  const handleSceneUpdate = async (
    sceneId: string,
    field: keyof Scene,
    value: unknown
  ) => {
    await updateScene.mutateAsync({
      id: sceneId,
      projectId: projectId!,
      updates: { [field]: value },
    });
  };

  const handleCharacterToggle = async (sceneId: string, characterId: string, currentChars: string[]) => {
    const newChars = currentChars.includes(characterId)
      ? currentChars.filter((id) => id !== characterId)
      : [...currentChars, characterId];

    await handleSceneUpdate(sceneId, 'characters_in_scene', newChars);
  };

  const handleContinue = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({
      id: projectId,
      updates: { status: 'images' },
    });
    navigate(`/project/${projectId}/images`);
  };

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
        <Button
          onClick={handleGenerateStoryboard}
          disabled={isGenerating || !project?.timestamps?.length}
          className="gap-2"
        >
          <Wand2 className="h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate Storyboard'}
        </Button>
      </div>

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
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">
                    Scene {scene.scene_number}: {formatTime(scene.start_time)} -{' '}
                    {formatTime(scene.end_time)}
                  </CardTitle>
                </div>
                <p className="text-sm text-muted-foreground italic ml-8">
                  "{scene.lyric_snippet}"
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Scene Description
                    </Label>
                    <Textarea
                      value={scene.scene_description}
                      onChange={(e) =>
                        handleSceneUpdate(scene.id, 'scene_description', e.target.value)
                      }
                      placeholder="Describe what happens in this scene..."
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Characters in Scene
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {characters?.map((char) => (
                        <label
                          key={char.id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full cursor-pointer hover:bg-muted/80 transition-colors"
                        >
                          <Checkbox
                            checked={scene.characters_in_scene.includes(char.id)}
                            onCheckedChange={() =>
                              handleCharacterToggle(
                                scene.id,
                                char.id,
                                scene.characters_in_scene
                              )
                            }
                          />
                          <span className="text-sm">{char.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Image Prompt
                    </Label>
                    <Textarea
                      value={scene.image_prompt}
                      onChange={(e) =>
                        handleSceneUpdate(scene.id, 'image_prompt', e.target.value)
                      }
                      placeholder="Prompt for generating the scene image..."
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Animation Prompt
                    </Label>
                    <Textarea
                      value={scene.animation_prompt}
                      onChange={(e) =>
                        handleSceneUpdate(scene.id, 'animation_prompt', e.target.value)
                      }
                      placeholder="Describe how this scene should animate..."
                      className="min-h-[80px] text-sm"
                    />
                  </div>
                </div>
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