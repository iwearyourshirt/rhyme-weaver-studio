import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Star, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  useCharacters,
  useCreateCharacter,
  useUpdateCharacter,
  useDeleteCharacter,
} from '@/hooks/useCharacters';
import { useDebug } from '@/contexts/DebugContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Characters() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: characters, isLoading } = useCharacters(projectId);
  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData, logApiCall } = useDebug();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setCurrentPage('Characters');
    setProjectData({ project, characters });
  }, [setCurrentPage, setProjectData, project, characters]);

  const handleCreateCharacter = async () => {
    if (!projectId || !newCharName.trim() || !newCharDesc.trim()) return;

    try {
      await createCharacter.mutateAsync({
        projectId,
        name: newCharName,
        description: newCharDesc,
      });
      setNewCharName('');
      setNewCharDesc('');
      setDialogOpen(false);
      toast.success('Character created!');
    } catch (error) {
      toast.error('Failed to create character');
    }
  };

  const handleGenerateImages = async (characterId: string) => {
    setIsGenerating(true);
    // Placeholder - will connect to fal.ai later
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const mockImages = [
      'https://images.unsplash.com/photo-1472289065668-ce650ac443d2?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&h=200&fit=crop',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=200&h=200&fit=crop',
    ];

    await updateCharacter.mutateAsync({
      id: characterId,
      projectId: projectId!,
      updates: { reference_images: mockImages },
    });

    logApiCall('Generate Reference Images', { characterId }, mockImages);
    toast.success('Reference images generated! (Demo data)');
    setIsGenerating(false);
  };

  const handleSetPrimary = async (characterId: string, imageUrl: string) => {
    await updateCharacter.mutateAsync({
      id: characterId,
      projectId: projectId!,
      updates: { primary_image_url: imageUrl },
    });
    toast.success('Primary image set!');
  };

  const handleContinue = async () => {
    if (!projectId) return;
    await updateProject.mutateAsync({
      id: projectId,
      updates: { status: 'storyboard' },
    });
    navigate(`/project/${projectId}/storyboard`);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Characters
          </h1>
          <p className="text-muted-foreground mt-1">
            Define the characters in your nursery rhyme
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Character
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Character</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="char-name">Character Name</Label>
                <Input
                  id="char-name"
                  placeholder="e.g., Little Star"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="char-desc">Description</Label>
                <Textarea
                  id="char-desc"
                  placeholder="Describe the character's appearance and personality..."
                  value={newCharDesc}
                  onChange={(e) => setNewCharDesc(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>
              <Button
                onClick={handleCreateCharacter}
                disabled={
                  !newCharName.trim() ||
                  !newCharDesc.trim() ||
                  createCharacter.isPending
                }
                className="w-full"
              >
                {createCharacter.isPending ? 'Creating...' : 'Create Character'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {characters?.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              No characters yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Add characters to your nursery rhyme to get started with the
              storyboard.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Character
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters?.map((character) => (
            <Card key={character.id} className="card-shadow group">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-lg">{character.name}</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-2"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Character?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{character.name}".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          deleteCharacter.mutate({
                            id: character.id,
                            projectId: projectId!,
                          })
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {character.description}
                </p>

                {character.reference_images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {character.reference_images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSetPrimary(character.id, img)}
                        className={cn(
                          'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                          character.primary_image_url === img
                            ? 'border-primary'
                            : 'border-transparent hover:border-muted-foreground/50'
                        )}
                      >
                        <img
                          src={img}
                          alt={`${character.name} reference ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {character.primary_image_url === img && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <Star className="h-3 w-3 text-primary-foreground fill-current" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleGenerateImages(character.id)}
                    disabled={isGenerating}
                  >
                    <Wand2 className="h-4 w-4" />
                    {isGenerating ? 'Generating...' : 'Generate Reference Images'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={!characters || characters.length === 0}
          className="gap-2"
        >
          Continue to Storyboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}