import { useLocation, Link } from 'react-router-dom';
 import { ChevronRight, Home } from 'lucide-react';
 import { useProject } from '@/hooks/useProjects';
 import { projectNavItems } from './AppSidebar';
 import {
   Breadcrumb,
   BreadcrumbItem,
   BreadcrumbLink,
   BreadcrumbList,
   BreadcrumbPage,
   BreadcrumbSeparator,
 } from '@/components/ui/breadcrumb';
 
// Extract projectId from URL path like /project/:projectId/step
function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/project\/([^/]+)/);
  return match ? match[1] : null;
}

 export function Breadcrumbs() {
   const location = useLocation();
  const projectId = getProjectIdFromPath(location.pathname);
   const { data: project } = useProject(projectId);
 
   // Get current step from the path
   const pathParts = location.pathname.split('/').filter(Boolean);
   const currentStep = pathParts[pathParts.length - 1];
   const currentNavItem = projectNavItems.find(item => item.url === currentStep);
 
   // If we're on the home page
   if (location.pathname === '/') {
     return (
       <Breadcrumb>
         <BreadcrumbList>
           <BreadcrumbItem>
             <BreadcrumbPage className="flex items-center gap-2">
               <Home className="h-4 w-4" />
               <span>Projects</span>
             </BreadcrumbPage>
           </BreadcrumbItem>
         </BreadcrumbList>
       </Breadcrumb>
     );
   }
 
   // If we're in a project
   if (projectId && currentNavItem) {
     const CurrentIcon = currentNavItem.icon;
     
     return (
       <Breadcrumb>
         <BreadcrumbList>
           <BreadcrumbItem>
             <BreadcrumbLink asChild>
               <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                 <Home className="h-4 w-4" />
                 <span>Projects</span>
               </Link>
             </BreadcrumbLink>
           </BreadcrumbItem>
           
           <BreadcrumbSeparator>
             <ChevronRight className="h-4 w-4" />
           </BreadcrumbSeparator>
           
           <BreadcrumbItem>
             <BreadcrumbLink asChild>
               <Link 
                 to={`/project/${projectId}/setup`} 
                 className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
               >
                 {project?.name || 'Project'}
               </Link>
             </BreadcrumbLink>
           </BreadcrumbItem>
           
           <BreadcrumbSeparator>
             <ChevronRight className="h-4 w-4" />
           </BreadcrumbSeparator>
           
           <BreadcrumbItem>
             <BreadcrumbPage className="flex items-center gap-2 font-medium">
               <CurrentIcon className="h-4 w-4" />
               <span>{currentNavItem.title}</span>
             </BreadcrumbPage>
           </BreadcrumbItem>
         </BreadcrumbList>
       </Breadcrumb>
     );
   }
 
   // Fallback for other pages
   return (
     <Breadcrumb>
       <BreadcrumbList>
         <BreadcrumbItem>
           <BreadcrumbLink asChild>
             <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
               <Home className="h-4 w-4" />
               <span>Projects</span>
             </Link>
           </BreadcrumbLink>
         </BreadcrumbItem>
       </BreadcrumbList>
     </Breadcrumb>
   );
 }