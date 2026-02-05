import { useEffect, useState } from 'react';
import { Plus, Folder, Trash2, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjects, useCreateProject, useDeleteProject, useUpdateProject } from '@/hooks/useProjects';
import { useDebug } from '@/contexts/DebugContext';
import { StatusBadge } from '@/components/ui/status-badge';
import type { ProjectStatus } from '@/types/database';
import { toast } from 'sonner';

const statusLabels: Record<ProjectStatus, string> = {
  setup: 'Setup',
  characters: 'Characters',
  storyboard: 'Storyboard',
  images: 'Image Generation',
  videos: 'Video Generation',
  export: 'Ready to Export',
};

export default function ProjectsList() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const { setCurrentPage, setProjectData } = useDebug();
  const [newProjectName, setNewProjectName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingProject, setRenamingProject] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  useEffect(() => {
    setCurrentPage('Projects List');
    setProjectData(projects);
  }, [setCurrentPage, setProjectData, projects]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await createProject.mutateAsync(newProjectName);
    setNewProjectName('');
    setDialogOpen(false);
    navigate(`/project/${project.id}/setup`);
  };

  const handleOpenProject = (projectId: string, status: ProjectStatus) => {
    navigate(`/project/${projectId}/${status}`);
  };

  const handleOpenRenameDialog = (e: React.MouseEvent, project: { id: string; name: string }) => {
    e.stopPropagation();
    setRenamingProject(project);
    setRenameValue(project.name);
    setRenameDialogOpen(true);
  };

  const handleRenameProject = async () => {
    if (!renamingProject || !renameValue.trim()) return;
    try {
      await updateProject.mutateAsync({
        id: renamingProject.id,
        updates: { name: renameValue.trim() },
      });
      toast.success('Project renamed');
      setRenameDialogOpen(false);
      setRenamingProject(null);
    } catch (error) {
      toast.error('Failed to rename project');
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your nursery rhyme videos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="My Nursery Rhyme"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
              </div>
              <Button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || createProject.isPending}
                className="w-full"
              >
                {createProject.isPending ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Folder className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No projects yet
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Create your first nursery rhyme video project to get started!
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects?.map((project) => (
            <Card
              key={project.id}
              className="border hover:border-foreground/20 transition-colors cursor-pointer group"
              onClick={() => handleOpenProject(project.id, project.status)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-medium line-clamp-1">
                  {project.name}
                </CardTitle>
                <div className="flex items-center gap-0.5 -mt-1 -mr-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleOpenRenameDialog(e, project)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{project.name}" and all its
                        characters, scenes, and generated content.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProject.mutate(project.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {statusLabels[project.status]}
                  </span>
                  <StatusBadge status={project.status === 'export' ? 'done' : 'pending'} />
                </div>
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                  {new Date(project.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="rename">Project Name</Label>
              <Input
                id="rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameProject()}
              />
            </div>
            <Button
              onClick={handleRenameProject}
              disabled={!renameValue.trim() || updateProject.isPending}
              className="w-full"
            >
              {updateProject.isPending ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}