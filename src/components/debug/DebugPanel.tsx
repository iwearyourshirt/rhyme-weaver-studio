import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebug } from '@/contexts/DebugContext';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const { isOpen, setIsOpen, currentPage, projectData, lastApiCall, promptLogs, clearPromptLogs } = useDebug();
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
      promptLogs: promptLogs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
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

      <Tabs defaultValue="general" className="flex flex-col h-[calc(100vh-8rem)]">
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API Calls</TabsTrigger>
          <TabsTrigger value="prompts">
            Prompts
            {promptLogs.length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                {promptLogs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1">
          <TabsContent value="general" className="p-4 space-y-6 mt-0">
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
              <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                {projectData
                  ? JSON.stringify(projectData, null, 2)
                  : 'No project data'}
              </pre>
            </section>
          </TabsContent>

          <TabsContent value="api" className="p-4 space-y-6 mt-0">
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
                    <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-32 mt-1 whitespace-pre-wrap break-words">
                      {JSON.stringify(lastApiCall.request, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-medium">Response:</span>
                    <pre className="p-2 bg-muted rounded-md text-xs overflow-x-auto max-h-32 mt-1 whitespace-pre-wrap break-words">
                      {JSON.stringify(lastApiCall.response, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No API calls yet</p>
              )}
            </section>
          </TabsContent>

          <TabsContent value="prompts" className="p-4 space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Image Generation Prompts
              </h3>
              {promptLogs.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearPromptLogs}>
                  Clear
                </Button>
              )}
            </div>
            
            {promptLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No prompt logs yet. Generate character images to see the prompts sent to fal.ai.
              </p>
            ) : (
              <div className="space-y-4">
                {promptLogs.map((log, logIndex) => (
                  <div key={logIndex} className="space-y-2 border-b border-border pb-4 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-primary">{log.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {log.prompts.map((prompt, promptIndex) => (
                      <div key={promptIndex} className="space-y-1">
                        <span className="text-xs text-muted-foreground">
                          Prompt {promptIndex + 1}:
                        </span>
                        <pre className="p-2 bg-muted rounded-md text-xs whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                          {prompt}
                        </pre>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

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