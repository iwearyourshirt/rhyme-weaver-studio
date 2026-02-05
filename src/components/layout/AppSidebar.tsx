import { Home, Users, Layout, Image, Video, Download, Music, ChevronDown, FolderOpen } from 'lucide-react';
import { NavLink, useParams, useLocation, Link } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/useProjects';

const mainNavItems = [
  { title: 'Projects', url: '/', icon: Home },
];

export const projectNavItems = [
  { title: 'Setup', url: 'setup', icon: Music, status: 'setup' },
  { title: 'Characters', url: 'characters', icon: Users, status: 'characters' },
  { title: 'Storyboard', url: 'storyboard', icon: Layout, status: 'storyboard' },
  { title: 'Images', url: 'images', icon: Image, status: 'images' },
  { title: 'Videos', url: 'videos', icon: Video, status: 'videos' },
  { title: 'Export', url: 'export', icon: Download, status: 'export' },
];

export function AppSidebar() {
  const { projectId } = useParams();
  const location = useLocation();
  const { data: project } = useProject(projectId);
  
  // Keep project section open when viewing a project
  const isInProject = !!projectId;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Music className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-sidebar-foreground">
              Rhyme Studio
            </h1>
            <p className="text-xs text-muted-foreground">Video Creator</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors',
                          isActive && location.pathname === '/'
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'hover:bg-sidebar-accent/50'
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {projectId && (
          <SidebarGroup>
            <Collapsible defaultOpen={isInProject} className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[140px]">
                      {project?.name || 'Current Project'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {projectNavItems.map((item, index) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={`/project/${projectId}/${item.url}`}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-colors',
                                isActive
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                  : 'hover:bg-sidebar-accent/50'
                              )
                            }
                          >
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                              {index + 1}
                            </div>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Nursery Rhyme Video Studio
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}