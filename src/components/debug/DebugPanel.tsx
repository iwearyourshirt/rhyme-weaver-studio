import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebug } from '@/contexts/DebugContext';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const { isOpen, setIsOpen, currentPage, projectData, lastApiCall } = useDebug();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const debugInfo = {
      currentPage,
      projectData,
      lastApiCall: lastApiCall
        ? {
            ...lastApiCall,
            timestamp: lastApiCall.timestamp.toISOString(),
          }
        : null,
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 w-96 bg-card border-l border-border shadow-xl transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-display font-semibold">Debug Panel</h2>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Current Page
            </h3>
            <code className="block p-2 bg-muted rounded-md text-sm">
              {currentPage || 'Unknown'}
            </code>
          </section>

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Project Data
            </h3>
            <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-64">
              {projectData
                ? JSON.stringify(projectData, null, 2)
                : 'No project data'}
            </pre>
          </section>

          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Last API Call
            </h3>
            {lastApiCall ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {lastApiCall.timestamp.toLocaleString()} - {lastApiCall.type}
                </div>
                <div>
                  <span className="text-xs font-medium">Request:</span>
                  <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-32 mt-1">
                    {JSON.stringify(lastApiCall.request, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-medium">Response:</span>
                  <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-32 mt-1">
                    {JSON.stringify(lastApiCall.response, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No API calls yet</p>
            )}
          </section>
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card">
        <Button onClick={handleCopy} className="w-full" variant="secondary">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Debug Info
            </>
          )}
        </Button>
      </div>
    </div>
  );
}