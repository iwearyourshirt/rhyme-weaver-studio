import { X, Copy, Check, Video } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebug } from '@/contexts/DebugContext';
import { cn } from '@/lib/utils';

const COST_PER_SECOND = 0.04;
const VIDEO_DURATION = 6;
const COST_PER_VIDEO = COST_PER_SECOND * VIDEO_DURATION;

export function DebugPanel() {
  const { 
    isOpen, 
    setIsOpen, 
    currentPage, 
    projectData, 
    lastApiCall, 
    promptLogs, 
    clearPromptLogs,
    videoDebug,
    clearVideoDebug,
  } = useDebug();
  const [copied, setCopied] = useState(false);
  const [copiedVideo, setCopiedVideo] = useState(false);

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
      videoDebug,
    };

    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyVideoDebug = () => {
    const doneScenes = videoDebug.scenes.filter((s) => s.status === 'done');
    const failedScenes = videoDebug.scenes.filter((s) => s.status === 'failed');
    const generatingScenes = videoDebug.scenes.filter((s) => s.status === 'generating');
    const pendingScenes = videoDebug.scenes.filter((s) => s.status === 'pending');

    const report = `
VIDEO GENERATION DEBUG REPORT
=============================
Model: ${videoDebug.model}

SUMMARY
-------
Total Scenes: ${videoDebug.scenes.length}
Completed: ${doneScenes.length}
Failed: ${failedScenes.length}
Generating: ${generatingScenes.length}
Pending: ${pendingScenes.length}

Total Generation Time: ${formatDuration(videoDebug.totalGenerationTimeMs)}
Estimated Cost: $${(doneScenes.length * COST_PER_VIDEO).toFixed(2)}

SCENE DETAILS
-------------
${videoDebug.scenes.map((s) => {
  const genTime = s.generationStartTime && s.generationEndTime 
    ? formatDuration(s.generationEndTime - s.generationStartTime)
    : 'N/A';
  return `Scene ${s.sceneNumber}: ${s.status.toUpperCase()}
  Request ID: ${s.requestId || 'N/A'}
  Generation Time: ${genTime}
  Video URL: ${s.videoUrl || 'N/A'}
  Error: ${s.error || 'None'}`;
}).join('\n\n')}
`.trim();

    navigator.clipboard.writeText(report);
    setCopiedVideo(true);
    setTimeout(() => setCopiedVideo(false), 2000);
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const doneCount = videoDebug.scenes.filter((s) => s.status === 'done').length;
  const totalCount = videoDebug.scenes.length;

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
        <TabsList className="mx-4 mt-2 grid w-auto grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="prompts">
            Prompts
            {promptLogs.length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full px-1.5">
                {promptLogs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="h-3 w-3 mr-1" />
            Video
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

          <TabsContent value="video" className="p-4 space-y-4 mt-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                Video Generation
              </h3>
              {videoDebug.scenes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearVideoDebug}>
                  Clear
                </Button>
              )}
            </div>

            {/* Model Info */}
            <section className="space-y-2">
              <h4 className="text-xs font-medium">Current Model</h4>
              <code className="block p-2 bg-muted rounded-md text-xs break-all">
                {videoDebug.model}
              </code>
            </section>

            {/* Stats Summary */}
            {videoDebug.scenes.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-medium">Stats</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted rounded-md">
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="ml-1 font-medium">{doneCount}/{totalCount}</span>
                  </div>
                  <div className="p-2 bg-muted rounded-md">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="ml-1 font-medium">{formatDuration(videoDebug.totalGenerationTimeMs)}</span>
                  </div>
                  <div className="p-2 bg-muted rounded-md col-span-2">
                    <span className="text-muted-foreground">Est. Cost:</span>
                    <span className="ml-1 font-medium">${(doneCount * COST_PER_VIDEO).toFixed(2)}</span>
                    <span className="text-muted-foreground ml-1">({doneCount} × $0.24)</span>
                  </div>
                </div>
              </section>
            )}

            {/* Scene Status Table */}
            {videoDebug.scenes.length > 0 ? (
              <section className="space-y-2">
                <h4 className="text-xs font-medium">Scene Status</h4>
                <div className="space-y-2">
                  {videoDebug.scenes.map((scene) => (
                    <div 
                      key={scene.sceneId} 
                      className={cn(
                        "p-2 rounded-md text-xs space-y-1",
                        scene.status === 'done' && "bg-success/10 border border-success/30",
                        scene.status === 'failed' && "bg-destructive/10 border border-destructive/30",
                        scene.status === 'generating' && "bg-warning/10 border border-warning/30",
                        scene.status === 'pending' && "bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Scene {scene.sceneNumber}</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] uppercase font-medium",
                          scene.status === 'done' && "bg-success/20 text-success",
                          scene.status === 'failed' && "bg-destructive/20 text-destructive",
                          scene.status === 'generating' && "bg-warning/20 text-warning-foreground",
                          scene.status === 'pending' && "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                          {scene.status}
                        </span>
                      </div>
                      {scene.requestId && (
                        <div className="text-muted-foreground truncate">
                          ID: {scene.requestId.substring(0, 20)}...
                        </div>
                      )}
                      {scene.generationStartTime && scene.generationEndTime && (
                        <div className="text-muted-foreground">
                          Gen time: {formatDuration(scene.generationEndTime - scene.generationStartTime)}
                        </div>
                      )}
                      {scene.error && (
                        <div className="text-destructive text-[10px]">
                          Error: {scene.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Copy Debug Report Button */}
                <Button 
                  onClick={handleCopyVideoDebug} 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                >
                  {copiedVideo ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Debug Report
                    </>
                  )}
                </Button>
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">
                No video generation data yet. Start generating videos to see debug info.
              </p>
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
