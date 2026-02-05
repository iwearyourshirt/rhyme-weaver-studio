import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { CostBadge } from './CostBadge';
import { DebugPanel } from '@/components/debug/DebugPanel';
import { DebugTrigger } from '@/components/debug/DebugTrigger';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 h-12 border-b border-border flex items-center gap-3 px-4 bg-background/95 backdrop-blur-sm">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <Breadcrumbs />
            <div className="flex-1" />
            <CostBadge />
          </header>
          <div className="flex-1 overflow-auto p-8">
            {children}
          </div>
        </main>
      </div>
      <DebugTrigger />
      <DebugPanel />
    </SidebarProvider>
  );
}