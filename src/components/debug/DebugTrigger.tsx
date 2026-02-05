import { Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDebug } from '@/contexts/DebugContext';

export function DebugTrigger() {
  const { setIsOpen } = useDebug();

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-lg"
      onClick={() => setIsOpen(true)}
    >
      <Wrench className="h-4 w-4" />
    </Button>
  );
}