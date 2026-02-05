import { Palette } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CreativeDirectionForm } from './CreativeDirectionForm';
import { useState } from 'react';

interface CreativeDirectionBadgeProps {
  styleDirection: string | null;
  animationDirection: string | null;
  cinematographyDirection: string | null;
  onSave: (data: {
    style_direction: string;
    animation_direction: string;
    cinematography_direction: string;
    creative_brief: string;
  }) => Promise<void>;
  isSaving?: boolean;
}

export function CreativeDirectionBadge({
  styleDirection,
  animationDirection,
  cinematographyDirection,
  onSave,
  isSaving = false,
}: CreativeDirectionBadgeProps) {
  const [open, setOpen] = useState(false);

  const handleSave = async (data: {
    style_direction: string;
    animation_direction: string;
    cinematography_direction: string;
    creative_brief: string;
  }) => {
    await onSave(data);
    setOpen(false);
  };

  if (!styleDirection) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Badge
          variant="secondary"
          className="cursor-pointer hover:bg-secondary/80 gap-1.5 text-xs"
        >
          <Palette className="h-3 w-3" />
          {styleDirection}
        </Badge>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Creative Direction</DialogTitle>
        </DialogHeader>
        <div className="pt-2">
          <p className="text-sm text-muted-foreground mb-4">
            Changes apply to future generations only.
          </p>
          <CreativeDirectionForm
            styleDirection={styleDirection || ''}
            animationDirection={animationDirection || ''}
            cinematographyDirection={cinematographyDirection || ''}
            onSave={handleSave}
            isSaving={isSaving}
            showSaveButton={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
