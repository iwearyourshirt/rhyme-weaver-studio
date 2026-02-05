import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowRight, Star, Trash2, Wand2, Loader2, RefreshCw, ZoomIn, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface PreviewImage {
  url: string;
  characterId: string;
  characterName: string;
  isPrimary: boolean;
}

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
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [generatingAnglesCharId, setGeneratingAnglesCharId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

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
    const character = characters?.find((c) => c.id === characterId);
    if (!character) {
      toast.error('Character not found');
      return;
    }

    setGeneratingCharId(characterId);
    
    try {
      const requestPayload = {
        character_name: character.name,
        character_description: character.description,
      };
      
      console.log('Calling generate-character-images edge function...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-images`,
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
        throw new Error(data.error || 'Image generation failed');
      }

      logApiCall('Generate Reference Images', requestPayload, data);
      
      // Save images to character
      await updateCharacter.mutateAsync({
        id: characterId,
        projectId: projectId!,
        updates: {
          reference_images: data.images,
          primary_image_url: data.images[0] || null,
        },
      });
      
      toast.success('Reference images generated successfully!');
    } catch (error) {
      console.error('Image generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Image generation failed';
      logApiCall('Generate Reference Images (Error)', { characterId }, { error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setGeneratingCharId(null);
    }
  };

  const handleGenerateConsistentAngles = async (characterId: string) => {
    const character = characters?.find((c) => c.id === characterId);
    if (!character?.primary_image_url) {
      toast.error('Please set a primary image first');
      return;
    }

    setGeneratingAnglesCharId(characterId);
    
    try {
      const requestPayload = {
        character_name: character.name,
        character_description: character.description,
        primary_image_url: character.primary_image_url,
      };
      
      console.log('Calling generate-consistent-angles edge function...');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-consistent-angles`,
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
        throw new Error(data.error || 'Angle generation failed');
      }

      logApiCall('Generate Consistent Angles', requestPayload, data);
      
      // Append new images to existing ones, keeping primary first
      const existingImages = character.reference_images || [];
      const newImages = [character.primary_image_url, ...data.images.filter((img: string) => img !== character.primary_image_url)];
      const allImages = [...new Set([...newImages, ...existingImages])];
      
      await updateCharacter.mutateAsync({
        id: characterId,
        projectId: projectId!,
        updates: {
          reference_images: allImages,
        },
      });
      
      toast.success('Consistent angle images generated!');
    } catch (error) {
      console.error('Angle generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Angle generation failed';
      logApiCall('Generate Consistent Angles (Error)', { characterId }, { error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setGeneratingAnglesCharId(null);
    }
  };

  const handleSetPrimary = async (characterId: string, imageUrl: string) => {
    await updateCharacter.mutateAsync({
      id: characterId,
      projectId: projectId!,
      updates: { primary_image_url: imageUrl },
    });
    setPreviewImage(null);
    toast.success('Primary image set!');
  };

  const openImagePreview = (
    url: string,
    characterId: string,
    characterName: string,
    isPrimary: boolean
  ) => {
    setPreviewImage({ url, characterId, characterName, isPrimary });
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
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {character.reference_images.map((img, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors group/image',
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
                          {/* Hover overlay with zoom button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1"
                              onClick={() => openImagePreview(
                                img,
                                character.id,
                                character.name,
                                character.primary_image_url === img
                              )}
                            >
                              <ZoomIn className="h-3 w-3" />
                              View
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {character.primary_image_url && (
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => handleGenerateConsistentAngles(character.id)}
                          disabled={generatingAnglesCharId === character.id}
                        >
                          {generatingAnglesCharId === character.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          {generatingAnglesCharId === character.id ? 'Generating...' : 'Generate Angles'}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleGenerateImages(character.id)}
                        disabled={generatingCharId === character.id}
                      >
                        {generatingCharId === character.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        {generatingCharId === character.id ? 'Regenerating...' : 'New Set'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleGenerateImages(character.id)}
                    disabled={generatingCharId === character.id}
                  >
                    {generatingCharId === character.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {generatingCharId === character.id ? 'Generating (30-60s)...' : 'Generate Reference Images'}
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewImage?.characterName}
              {previewImage?.isPrimary && (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-primary">
                  <Star className="h-4 w-4 fill-current" />
                  Primary
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {previewImage?.isPrimary 
                ? 'This is the primary reference image for this character.'
                : 'Click "Set as Primary" to use this as the main reference image.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative aspect-square w-full max-h-[60vh] overflow-hidden rounded-lg bg-muted">
            {previewImage && (
              <img
                src={previewImage.url}
                alt={`${previewImage.characterName} preview`}
                className="w-full h-full object-contain"
              />
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPreviewImage(null)}>
              Close
            </Button>
            {previewImage && !previewImage.isPrimary && (
              <Button 
                onClick={() => handleSetPrimary(previewImage.characterId, previewImage.url)}
                className="gap-2"
              >
                <Star className="h-4 w-4" />
                Set as Primary
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}