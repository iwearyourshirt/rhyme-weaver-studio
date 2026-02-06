import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useCostLogs, useCostLogsRealtime, getServiceName } from '@/hooks/useCostLogs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

// Extract projectId from URL path like /project/:projectId/step
function getProjectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/project\/([^/]+)/);
  return match ? match[1] : null;
}

export function CostBadge() {
  const location = useLocation();
  const projectId = getProjectIdFromPath(location.pathname);
  const { data: project } = useProject(projectId);
  const { data: costLogs } = useCostLogs(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [lastCost, setLastCost] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Enable realtime updates
  useCostLogsRealtime(projectId);

  // Listen for cost log updates and refetch
  useEffect(() => {
    const handleCostUpdate = (event: CustomEvent) => {
      if (event.detail?.projectId === projectId) {
        queryClient.invalidateQueries({ queryKey: ['cost-logs', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      }
    };

    window.addEventListener('cost-log-updated', handleCostUpdate as EventListener);
    return () => {
      window.removeEventListener('cost-log-updated', handleCostUpdate as EventListener);
    };
  }, [projectId, queryClient]);

  // Get total cost from project
  const totalCost = Number(project?.total_ai_cost || 0);

  // Pulse animation when cost increases
  useEffect(() => {
    if (lastCost !== null && totalCost > lastCost) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 1000);
      return () => clearTimeout(timer);
    }
    setLastCost(totalCost);
  }, [totalCost, lastCost]);

  // Don't show if not in a project context
  if (!projectId) return null;

  // Group costs by service for the modal
  const costsByService = costLogs?.reduce((acc, log) => {
    if (!acc[log.service]) {
      acc[log.service] = { count: 0, total: 0 };
    }
    acc[log.service].count += 1;
    acc[log.service].total += Number(log.cost);
    return acc;
  }, {} as Record<string, { count: number; total: number }>) || {};

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'gap-1.5 text-primary hover:text-primary/80 hover:bg-primary/10 font-mono text-xs transition-all',
          isPulsing && 'animate-pulse ring-2 ring-primary/50'
        )}
      >
        <DollarSign className="h-3.5 w-3.5" />
        <span>${totalCost.toFixed(2)}</span>
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              AI Cost Breakdown — {project?.name || 'Project'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Total Summary */}
            <div className="bg-primary/10 rounded-md p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total AI Spending</p>
              <p className="text-2xl font-semibold text-primary font-mono">
                ${totalCost.toFixed(2)}
              </p>
            </div>

            {/* Costs by Service */}
            {Object.keys(costsByService).length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Service</h3>
                <div className="border rounded-md divide-y">
                  {Object.entries(costsByService)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([service, data]) => (
                      <div key={service} className="flex items-center justify-between p-3">
                        <div>
                          <p className="font-medium text-sm">{getServiceName(service)}</p>
                          <p className="text-xs text-muted-foreground">{data.count} call{data.count !== 1 ? 's' : ''}</p>
                        </div>
                        <p className="font-medium text-primary font-mono text-sm">
                          ${data.total.toFixed(2)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No AI costs recorded yet. Start generating content to see cost breakdown.
              </p>
            )}

            {/* Individual Logs */}
            {costLogs && costLogs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
                <ScrollArea className="h-44 border rounded-md">
                  <div className="divide-y">
                    {costLogs.slice(0, 50).map((log) => (
                      <div key={log.id} className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-medium truncate flex-1 mr-2 text-sm">{log.operation}</p>
                          <p className="text-primary font-mono text-xs flex-shrink-0">
                            ${Number(log.cost).toFixed(4)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
