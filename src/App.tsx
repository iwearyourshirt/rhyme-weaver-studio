import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DebugProvider } from "@/contexts/DebugContext";
import { AppLayout } from "@/components/layout/AppLayout";
import ProjectsList from "./pages/ProjectsList";
import ProjectSetup from "./pages/ProjectSetup";
import Characters from "./pages/Characters";
import Storyboard from "./pages/Storyboard";
import ImageGeneration from "./pages/ImageGeneration";
import VideoGeneration from "./pages/VideoGeneration";
import Export from "./pages/Export";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DebugProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<ProjectsList />} />
              <Route path="/project/:projectId/setup" element={<ProjectSetup />} />
              <Route path="/project/:projectId/characters" element={<Characters />} />
              <Route path="/project/:projectId/storyboard" element={<Storyboard />} />
              <Route path="/project/:projectId/images" element={<ImageGeneration />} />
              <Route path="/project/:projectId/videos" element={<VideoGeneration />} />
              <Route path="/project/:projectId/export" element={<Export />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </DebugProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
