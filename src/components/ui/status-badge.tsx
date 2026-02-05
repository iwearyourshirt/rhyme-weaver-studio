import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { GenerationStatus } from '@/types/database';

interface StatusBadgeProps {
  status: GenerationStatus | 'ready';
  className?: string;
}

const statusConfig = {
  ready: {
    label: 'Ready',
    className: 'bg-muted text-muted-foreground',
  },
  pending: {
    label: 'Ready',
    className: 'bg-muted text-muted-foreground',
  },
  generating: {
    label: 'Generating',
    className: 'bg-warning/20 text-warning-foreground border-warning/30',
  },
  done: {
    label: 'Done',
    className: 'bg-success/20 text-success border-success/30',
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/20 text-destructive border-destructive/30',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        config.className,
        className
      )}
    >
      {status === 'generating' && (
        <Loader2 className="h-3 w-3 animate-spin" />
      )}
      {config.label}
    </span>
  );
}