import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
 
 interface PromptFeedbackProps {
   promptType: 'image' | 'animation';
   currentPrompt: string;
   sceneDescription: string;
   shotType?: string;
   siblingPrompt?: string;
   onRewrite: (newPrompt: string) => void;
 }
 
 export function PromptFeedback({ promptType, currentPrompt, sceneDescription, shotType, siblingPrompt, onRewrite }: PromptFeedbackProps) {
   const [feedback, setFeedback] = useState('');
   const [isRewriting, setIsRewriting] = useState(false);
 
   const handleRewrite = async () => {
     if (!feedback.trim()) {
       toast.error('Please enter feedback first');
       return;
     }
 
     setIsRewriting(true);
      try {
        const { data, error } = await supabase.functions.invoke('rewrite-prompt', {
          body: {
            prompt_type: promptType,
            current_prompt: currentPrompt,
            scene_description: sceneDescription,
            shot_type: shotType || null,
            sibling_prompt: siblingPrompt || null,
            feedback: feedback.trim(),
          },
        });

        if (error) {
          throw new Error(error.message || 'Failed to rewrite prompt');
        }

        if (!data) {
          throw new Error('No data returned');
        }

        onRewrite(data.rewritten_prompt);
        setFeedback('');
        toast.success(`${promptType === 'image' ? 'Image' : 'Animation'} prompt updated`);
     } catch (error) {
       console.error('Rewrite error:', error);
       toast.error(error instanceof Error ? error.message : 'Failed to rewrite prompt');
     } finally {
       setIsRewriting(false);
     }
   };
 
   return (
     <div className="flex gap-2 mt-2">
       <Input
         value={feedback}
         onChange={(e) => setFeedback(e.target.value)}
         placeholder="e.g. make it more dramatic, add sunset lighting..."
         className="text-xs h-8"
         onKeyDown={(e) => {
           if (e.key === 'Enter' && !e.shiftKey) {
             e.preventDefault();
             handleRewrite();
           }
         }}
       />
       <Button
         variant="outline"
         size="sm"
         onClick={handleRewrite}
         disabled={isRewriting || !feedback.trim()}
         className="h-8 gap-1.5 shrink-0"
       >
         {isRewriting ? (
           <Loader2 className="h-3 w-3 animate-spin" />
         ) : (
           <Sparkles className="h-3 w-3" />
         )}
         Rewrite
       </Button>
     </div>
   );
 }