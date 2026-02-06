import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
 import { Plus, ArrowRight, Star, Trash2, Wand2, Loader2, RefreshCw, ZoomIn, RotateCcw, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { supabase } from '@/integrations/supabase/client';
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
  const { setCurrentPage, setProjectData, logApiCall, logPrompts } = useDebug();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [generatingAnglesCharId, setGeneratingAnglesCharId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [editingCharacter, setEditingCharacter] = useState<{ id: string; name: string; description: string } | null>(null);
  const [deletingImage, setDeletingImage] = useState<{ characterId: string; imageUrl: string } | null>(null);

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
        project_id: projectId,
        character_id: character.id,
        character_type: character.character_type,
      };
      
      console.log('Calling generate-character-images edge function...');

      const { data, error } = await supabase.functions.invoke('generate-character-images', {
        body: requestPayload,
      });

      if (error) {
        throw new Error(error.message || 'Image generation failed');
      }

      if (!data) {
        throw new Error('Image generation returned no data');
      }

      logApiCall('Generate Reference Images', requestPayload, data);
      
      // Log prompts to debug panel
      if (data.prompts && Array.isArray(data.prompts)) {
        logPrompts('Generate Reference Images', data.prompts);
      }
      
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
        project_id: projectId,
        character_id: character.id,
        character_type: character.character_type,
      };
      
      console.log('Calling generate-consistent-angles edge function...');

      const { data, error } = await supabase.functions.invoke('generate-consistent-angles', {
        body: requestPayload,
      });

      if (error) {
        throw new Error(error.message || 'Angle generation failed');
      }

      if (!data) {
        throw new Error('Angle generation returned no data');
      }

      logApiCall('Generate Consistent Angles', requestPayload, data);
      
      // Log prompts to debug panel
      if (data.prompts && Array.isArray(data.prompts)) {
        logPrompts('Generate Consistent Angles', data.prompts);
      }
      
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

  const handleUpdateDescription = async () => {
    if (!editingCharacter || !projectId) return;
    
    try {
      await updateCharacter.mutateAsync({
        id: editingCharacter.id,
        projectId,
        updates: { 
          name: editingCharacter.name,
          description: editingCharacter.description 
        },
      });
      setEditingCharacter(null);
      toast.success('Character updated!');
    } catch (error) {
      toast.error('Failed to update character');
    }
  };

  const handleRemoveImage = async (characterId: string, imageUrl: string) => {
    const character = characters?.find((c) => c.id === characterId);
    if (!character) return;

    try {
      const updatedImages = character.reference_images.filter((img) => img !== imageUrl);
      const updates: { reference_images: string[]; primary_image_url?: string | null } = {
        reference_images: updatedImages,
      };

      // If we're removing the primary image, set a new one or null
      if (character.primary_image_url === imageUrl) {
        updates.primary_image_url = updatedImages[0] || null;
      }

      await updateCharacter.mutateAsync({
        id: characterId,
        projectId: projectId!,
        updates,
      });

      setDeletingImage(null);
      setPreviewImage(null);
      toast.success('Image removed');
    } catch (error) {
      toast.error('Failed to remove image');
    }
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
    <div className="max-w-5xl mx-auto animate-fade-in space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Characters
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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
        <Card className="border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-2">
              No characters yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Add characters to your nursery rhyme to get started.
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Character
            </Button>
          </CardContent>
        </Card>
      ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {characters?.map((character) => (
            <Card key={character.id} className="border group flex flex-col">
              {/* Card Header - fixed height, aligned */}
              <CardHeader className="p-4 pb-0 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-2">
                  <CardTitle className="text-lg font-semibold leading-tight">{character.name}</CardTitle>
                  {/* Simple toggle for Character/Environment */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs",
                      character.character_type !== 'environment' ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      Character
                    </span>
                    <Switch
                      checked={character.character_type === 'environment'}
                      onCheckedChange={(checked) => {
                        updateCharacter.mutate({
                          id: character.id,
                          projectId: projectId!,
                          updates: { character_type: checked ? 'environment' : 'character' },
                        });
                      }}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className={cn(
                      "text-xs",
                      character.character_type === 'environment' ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      Environment
                    </span>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setEditingCharacter({
                      id: character.id,
                      name: character.name,
                      description: character.description,
                    })}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
                </div>
              </CardHeader>

              {/* Card Content - consistent spacing */}
              <CardContent className="p-4 pt-3 flex-1 flex flex-col gap-3">

                {/* Description */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {character.description}
                </p>

                {/* Reference Images or Generate Button */}
                <div className="mt-auto space-y-3">
                  {character.reference_images.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-1.5">
                        {character.reference_images.map((img, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'relative aspect-square rounded overflow-hidden border-2 transition-colors group/image cursor-pointer',
                              character.primary_image_url === img
                                ? 'border-foreground'
                                : 'border-transparent hover:border-muted-foreground/50'
                            )}
                            onClick={() => handleSetPrimary(character.id, img)}
                          >
                            <img
                              src={img}
                              alt={`${character.name} reference ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {character.primary_image_url === img && (
                              <div className="absolute top-0.5 right-0.5 bg-foreground rounded-full p-0.5">
                                <Star className="h-2.5 w-2.5 text-background fill-current" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                              {character.primary_image_url !== img && (
                                <Button
                                  size="sm"
                                  className="h-5 text-[10px] px-1.5 gap-0.5 w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetPrimary(character.id, img);
                                  }}
                                >
                                  <Star className="h-2.5 w-2.5" />
                                  Primary
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-5 text-[10px] px-1.5 gap-0.5 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImagePreview(img, character.id, character.name, character.primary_image_url === img);
                                }}
                              >
                                <ZoomIn className="h-2.5 w-2.5" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-5 text-[10px] px-1.5 gap-0.5 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingImage({ characterId: character.id, imageUrl: img });
                                }}
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {character.primary_image_url && (
                          <Button
                            size="sm"
                            className="flex-1 h-9"
                            onClick={() => handleGenerateConsistentAngles(character.id)}
                            disabled={generatingAnglesCharId === character.id}
                          >
                            {generatingAnglesCharId === character.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            <span className="ml-1.5">{generatingAnglesCharId === character.id ? 'Generating...' : 'Angles'}</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => handleGenerateImages(character.id)}
                          disabled={generatingCharId === character.id}
                        >
                          {generatingCharId === character.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">{generatingCharId === character.id ? 'Generating...' : 'New Set'}</span>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-9"
                      onClick={() => handleGenerateImages(character.id)}
                      disabled={generatingCharId === character.id}
                    >
                      {generatingCharId === character.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      <span className="ml-2">{generatingCharId === character.id ? 'Generating...' : 'Generate Reference Images'}</span>
                    </Button>
                  )}
                </div>
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
      
      {/* Edit Character Dialog */}
      <Dialog open={!!editingCharacter} onOpenChange={(open) => !open && setEditingCharacter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Character</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-char-name">Character Name</Label>
              <Input
                id="edit-char-name"
                value={editingCharacter?.name || ''}
                onChange={(e) => setEditingCharacter(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-char-desc">Description</Label>
              <Textarea
                id="edit-char-desc"
                value={editingCharacter?.description || ''}
                onChange={(e) => setEditingCharacter(prev => prev ? { ...prev, description: e.target.value } : null)}
                className="min-h-[120px]"
              />
            </div>
            <Button
              onClick={handleUpdateDescription}
              disabled={updateCharacter.isPending}
              className="w-full"
            >
              {updateCharacter.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            {previewImage && (
              <Button 
                variant="destructive" 
                onClick={() => setDeletingImage({ 
                  characterId: previewImage.characterId, 
                  imageUrl: previewImage.url 
                })}
                className="gap-2 mr-auto"
              >
                <Trash2 className="h-4 w-4" />
                Remove Image
              </Button>
            )}
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

      {/* Delete Image Confirmation */}
      <AlertDialog open={!!deletingImage} onOpenChange={(open) => !open && setDeletingImage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this image from the character's reference images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingImage && handleRemoveImage(deletingImage.characterId, deletingImage.imageUrl)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}